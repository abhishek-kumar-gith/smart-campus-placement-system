const { z } = require('zod');
const path = require('path');
const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const Job = require('../models/Job.model');
const Recruiter = require('../models/Recruiter.model');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');
const { checkEligibility } = require('../services/eligibilityEngine');
const { calculateSkillMatch } = require('../services/skillMatching');
const { sendNotificationEmail } = require('../utils/email');
const Resume = require('../models/Resume.model');
const { createUserNotification } = require('../services/notificationService');
const {
  copyApplicationResume,
  removeApplicationResume,
  resolveApplicationResumePath,
} = require('../utils/applicationResumeStorage');

const createApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.jobId)) {
    return ApiResponse.error(res, 'Invalid job ID.', 400);
  }
  const student = await Student.findOne({ userId: req.user._id });
  if (!student) return ApiResponse.error(res, 'Student profile not found.', 404);
  const job = await Job.findById(req.body.jobId);
  if (!job || !job.isPublished || job.approvalStatus !== 'approved' || job.status !== 'active') {
    return ApiResponse.error(res, 'Job is not available.', 404);
  }
  if (job.publishDate && new Date(job.publishDate).getTime() > Date.now()) {
    return ApiResponse.error(res, 'This job is not published yet.', 404);
  }
  if (!job.applicationDeadline || new Date(job.applicationDeadline).getTime() < Date.now()) {
    return ApiResponse.error(res, 'The application deadline for this drive has passed.', 410);
  }
  const eligibility = checkEligibility(student, job);
  if (!eligibility.passed) {
    return ApiResponse.error(res, 'You are not eligible for this job.', 422, eligibility.reasons);
  }
  const match = calculateSkillMatch(student.skills, job.requiredSkills);
  let application = await Application.findOne({ studentId: student._id, jobId: job._id });
  if (application && application.status !== 'withdrawn') {
    return ApiResponse.error(res, 'You have already applied to this drive.', 409);
  }

  const resume = await Resume.findOne({ studentId: student._id });
  if (!resume) {
    return ApiResponse.error(
      res,
      'A resume is required before applying. Please upload your resume first.',
      400,
    );
  }
  if (resume.parsingStatus !== 'completed' || resume.mimeType !== 'application/pdf') {
    return ApiResponse.error(
      res,
      'Your resume is not ready. Please upload a valid PDF resume again.',
      400,
    );
  }

  let copiedResume;
  try {
    copiedResume = copyApplicationResume(resume);
  } catch (error) {
    return ApiResponse.error(res, error.message || 'Your resume file is unavailable.', error.statusCode || 400);
  }

  const submittedResumeSnapshot = {
    resumeId: resume._id,
    originalFileName: resume.fileName,
    fileSize: copiedResume.fileSize,
    storedFileName: copiedResume.storedFileName,
    submittedAt: new Date(),
  };
  if (!submittedResumeSnapshot.resumeId
    || !submittedResumeSnapshot.originalFileName
    || !submittedResumeSnapshot.storedFileName
    || !Number.isFinite(Number(submittedResumeSnapshot.fileSize))
    || !(submittedResumeSnapshot.submittedAt instanceof Date)) {
    removeApplicationResume(copiedResume.storedFileName);
    return ApiResponse.error(
      res,
      'A valid resume snapshot could not be created for this application.',
      400,
    );
  }

  if (application) {
    try {
      const reappliedStatusHistory = {
        status: 'applied',
        changedBy: req.user._id,
        changedByRole: req.user.role,
        reason: 'Reapplied after withdrawal',
      };
      const updateResult = await Application.updateOne(
        {
          _id: application._id,
          studentId: student._id,
          jobId: job._id,
          status: 'withdrawn',
        },
        {
          $set: {
            status: 'applied',
            coverLetter: req.body.coverLetter || '',
            skillMatchScore: match.score,
            matchedSkills: match.matchedSkills,
            missingSkills: match.missingSkills,
            isEligible: eligibility.passed,
            eligibilityDetails: eligibility,
            submittedResumeSnapshot,
            appliedAt: new Date(),
          },
          $push: { statusHistory: reappliedStatusHistory },
        },
        { runValidators: true },
      );
      if (!updateResult?.matchedCount) {
        removeApplicationResume(copiedResume.storedFileName);
        return ApiResponse.error(
          res,
          'The application status changed before reapplication could complete.',
          409,
        );
      }
      application.status = 'applied';
      application.statusHistory.push(reappliedStatusHistory);
      const updatedApplication = await Application.findById(application._id);
      application = updatedApplication || application;
    } catch (error) {
      removeApplicationResume(copiedResume.storedFileName);
      throw error;
    }
  } else {
    try {
      const createPayload = {
        studentId: student._id,
        jobId: job._id,
        companyId: job.companyId,
        coverLetter: req.body.coverLetter || '',
        submittedResumeSnapshot,
        ...match,
        eligibilityDetails: eligibility,
        statusHistory: [{
          status: 'applied',
          changedBy: req.user._id,
          changedByRole: req.user.role,
        }],
      };
      application = await Application.create(createPayload);
    } catch (error) {
      removeApplicationResume(copiedResume.storedFileName);
      throw error;
    }
  }
  return ApiResponse.success(res, application, 'Application submitted', 201);
};

const getApplications = async (req, res) => {
  let filter = {};
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    filter = { studentId: student._id };
  } else if (req.user.role === 'recruiter') {
    const ownJobs = await Job.find({ createdBy: req.user._id }).select('_id');
    filter = { jobId: { $in: ownJobs.map((job) => job._id) } };
  }
  const applications = await Application.find(filter)
      .populate({
        path: 'studentId',
        select: 'fullName rollNumber branch cgpa userId',
        populate: { path: 'userId', select: 'email' },
      })
      .populate('jobId companyId')
      .sort({ createdAt: -1 });
  const safeApplications = applications.map((application) => {
    const record = application.toObject();
    const snapshot = record.submittedResumeSnapshot;
    record.resume = snapshot
      ? {
          available: true,
          fileName: snapshot.originalFileName,
          submittedAt: snapshot.submittedAt,
          downloadUrl: `/api/v1/applications/${application._id}/resume`,
        }
      : { available: false };
    return record;
  });
  return ApiResponse.success(res, safeApplications);
};

const downloadApplicationResume = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid application ID.', 400);
  }
  const application = await Application.findById(req.params.id);
  if (!application) {
    return ApiResponse.error(res, 'Application not found.', 404);
  }

  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student || String(application.studentId) !== String(student._id)) {
      return ApiResponse.error(
        res,
        'You cannot download another student application resume.',
        403,
      );
    }
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved') {
      return ApiResponse.error(res, 'Recruiter account is not approved.', 403);
    }
    if (String(recruiter.companyId) !== String(application.companyId)) {
      return ApiResponse.error(res, 'You cannot download another company application resume.', 403);
    }
    const ownJob = await Job.findOne({
      _id: application.jobId,
      createdBy: req.user._id,
    }).select('_id');
    if (!ownJob) {
      return ApiResponse.error(
        res,
        'You cannot download an application for another recruiter job.',
        403,
      );
    }
  } else if (req.user.role !== 'admin') {
    return ApiResponse.error(res, 'Access denied.', 403);
  }

  const snapshot = application.submittedResumeSnapshot;
  if (!snapshot?.storedFileName) {
    return ApiResponse.error(res, 'Application resume is not available.', 404);
  }
  const filePath = resolveApplicationResumePath(snapshot.storedFileName);
  if (!filePath) {
    return ApiResponse.error(res, 'Application resume file not found.', 404);
  }

  const safeFileName = path.basename(snapshot.originalFileName || 'resume.pdf');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${safeFileName.replace(/["\\]/g, '')}"`,
  );
  return res.sendFile(filePath);
};

const updateApplicationStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid application ID.', 400);
  }
  const application = await Application.findById(req.params.id);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  if (application.status === 'withdrawn') {
    return ApiResponse.error(res, 'Withdrawn applications cannot be updated.', 409);
  }
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || String(recruiter.companyId) !== String(application.companyId)) {
      return ApiResponse.error(res, 'You cannot update applications for another company.', 403);
    }
    const ownJob = await Job.findOne({
      _id: application.jobId,
      createdBy: req.user._id,
    }).select('_id');
    if (!ownJob) {
      return ApiResponse.error(res, 'You cannot update applicants for another recruiter drive.', 403);
    }
    const allowedTransitions = {
      applied: ['shortlisted', 'rejected'],
      shortlisted: ['interview', 'rejected'],
      interview: ['selected', 'rejected'],
      selected: ['rejected'],
    };
    if (!allowedTransitions[application.status]?.includes(req.body.status)) {
      return ApiResponse.error(res, `Recruiters cannot move ${application.status} applications to ${req.body.status}.`, 409);
    }
  }
  if (req.body.status === 'placed' && req.user.role !== 'admin') {
    return ApiResponse.error(res, 'Only admin can finalize placed status.', 403);
  }
  application.status = req.body.status;
  if (req.user.role === 'recruiter' && req.body.feedback !== undefined) {
    application.recruiterFeedback = req.body.feedback;
  }
  application.statusHistory.push({
    status: req.body.status,
    changedBy: req.user._id,
    changedByRole: req.user.role,
    reason: req.body.reason || '',
  });
  await application.save();
  const student = await Student.findById(application.studentId).populate('userId', 'email');
  if (student?.userId?._id) {
    await createUserNotification({
      senderId: req.user._id,
      recipientUserId: student.userId._id,
      subject: req.body.status === 'shortlisted' ? 'Application shortlisted' : 'Application status updated',
      message: `Your application status has changed to ${req.body.status}.${req.body.reason ? ` ${req.body.reason}` : ''}`,
      eventType: 'application_status',
    });
  }
  if (['shortlisted', 'rejected'].includes(req.body.status) && student?.userId?.email) {
      const subject = req.body.status === 'shortlisted'
        ? 'Application Shortlisted'
        : 'Application Status Update';
      await sendNotificationEmail(
        student.userId.email,
        subject,
        `<h2>DCRUST Placement Portal</h2><p>Your application status has changed to <strong>${req.body.status}</strong>.</p>${req.body.reason ? `<p>Reason: ${req.body.reason}</p>` : ''}`,
      );
  }
  return ApiResponse.success(res, application, 'Application status updated');
};

const withdrawApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid application ID.', 400);
  }
  const student = await Student.findOne({ userId: req.user._id });
  if (!student) return ApiResponse.error(res, 'Student profile not found.', 404);
  const application = await Application.findOne({
    _id: req.params.id,
    studentId: student._id,
  });
  if (!application) {
    return ApiResponse.error(res, 'Application not found or you do not own it.', 404);
  }
  if (!['applied', 'shortlisted', 'interview'].includes(application.status)) {
    return ApiResponse.error(res, 'This application can no longer be withdrawn.', 409);
  }
  application.status = 'withdrawn';
  application.statusHistory.push({
    status: 'withdrawn',
    changedBy: req.user._id,
    changedByRole: req.user.role,
    reason: req.body.reason || 'Withdrawn by student',
  });
  await application.save();
  return ApiResponse.success(res, application, 'Application withdrawn');
};

module.exports = {
  createApplication,
  getApplications,
  updateApplicationStatus,
  withdrawApplication,
  downloadApplicationResume,
};
