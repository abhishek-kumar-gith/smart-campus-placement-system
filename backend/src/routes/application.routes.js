const router = require('express').Router();
const { z } = require('zod');
const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const Job = require('../models/Job.model');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { checkEligibility } = require('../services/eligibilityEngine');
const { calculateSkillMatch } = require('../services/skillMatching');
const Recruiter = require('../models/Recruiter.model');
const mongoose = require('mongoose');
const { sendNotificationEmail } = require('../utils/email');

router.post('/', protect, authorize('student'), validate(z.object({ jobId: z.string(), coverLetter: z.string().max(5000).optional() })), asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  if (!student) return ApiResponse.error(res, 'Student profile not found.', 404);
  const job = await Job.findById(req.body.jobId);
  if (!job || !job.isPublished || job.approvalStatus !== 'approved' || job.status !== 'active') return ApiResponse.error(res, 'Job is not available.', 404);
  if (job.publishDate && new Date(job.publishDate).getTime() > Date.now()) {
    return ApiResponse.error(res, 'This job is not published yet.', 404);
  }
  if (!job.applicationDeadline || new Date(job.applicationDeadline).getTime() < Date.now()) {
    return ApiResponse.error(res, 'The application deadline for this drive has passed.', 410);
  }
  const eligibility = checkEligibility(student, job);
  if (!eligibility.passed) return ApiResponse.error(res, 'You are not eligible for this job.', 422, eligibility.reasons);
  const match = calculateSkillMatch(student.skills, job.requiredSkills);
  let application = await Application.findOne({ studentId: student._id, jobId: job._id });
  if (application && application.status !== 'withdrawn') return ApiResponse.error(res, 'You have already applied to this drive.', 409);
  if (application) {
    application.status = 'applied';
    application.coverLetter = req.body.coverLetter || '';
    application.skillMatchScore = match.skillMatchScore;
    application.matchedSkills = match.matchedSkills;
    application.missingSkills = match.missingSkills;
    application.isEligible = eligibility.passed;
    application.eligibilityDetails = eligibility;
    application.appliedAt = new Date();
    application.statusHistory.push({ status: 'applied', changedBy: req.user._id, changedByRole: req.user.role, reason: 'Reapplied after withdrawal' });
    await application.save();
  } else {
    application = await Application.create({ studentId: student._id, jobId: job._id, companyId: job.companyId, coverLetter: req.body.coverLetter || '', ...match, eligibilityDetails: eligibility, statusHistory: [{ status: 'applied', changedBy: req.user._id, changedByRole: req.user.role }] });
  }
  return ApiResponse.success(res, application, 'Application submitted', 201);
}));
router.get('/', protect, asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === 'student') {
    filter = { studentId: (await Student.findOne({ userId: req.user._id }))._id };
  } else if (req.user.role === 'recruiter') {
    const ownJobs = await Job.find({ createdBy: req.user._id }).select('_id');
    filter = { jobId: { $in: ownJobs.map((job) => job._id) } };
  }
  return ApiResponse.success(res, await Application.find(filter)
    .populate({
      path: 'studentId',
      select: 'fullName rollNumber branch cgpa userId',
      populate: { path: 'userId', select: 'email' },
    })
    .populate('jobId companyId')
    .sort({ createdAt: -1 }));
}));
router.patch('/:id/status', protect, authorize('admin', 'recruiter'), validate(z.object({ status: z.enum(['shortlisted', 'interview', 'selected', 'rejected', 'placed']), reason: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  if (application.status === 'withdrawn') return ApiResponse.error(res, 'Withdrawn applications cannot be updated.', 409);
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || String(recruiter.companyId) !== String(application.companyId)) {
      return ApiResponse.error(res, 'You cannot update applications for another company.', 403);
    }
    const ownJob = await Job.findOne({ _id: application.jobId, createdBy: req.user._id }).select('_id');
    if (!ownJob) {
      return ApiResponse.error(res, 'You cannot update applicants for another recruiter drive.', 403);
    }
  }
  if (req.body.status === 'placed' && req.user.role !== 'admin') return ApiResponse.error(res, 'Only admin can finalize placed status.', 403);
  application.status = req.body.status;
  application.statusHistory.push({ status: req.body.status, changedBy: req.user._id, changedByRole: req.user.role, reason: req.body.reason || '' });
  await application.save();
  if (['shortlisted', 'rejected'].includes(req.body.status)) {
    const student = await Student.findById(application.studentId).populate('userId', 'email');
    if (student?.userId?.email) {
      const subject = req.body.status === 'shortlisted' ? 'Application Shortlisted' : 'Application Status Update';
      await sendNotificationEmail(student.userId.email, subject, `<h2>Smart Campus Placement</h2><p>Your application status has changed to <strong>${req.body.status}</strong>.</p>${req.body.reason ? `<p>Reason: ${req.body.reason}</p>` : ''}`);
    }
  }
  return ApiResponse.success(res, application, 'Application status updated');
}));

router.patch('/:id/withdraw', protect, authorize('student'), validate(z.object({
  reason: z.string().trim().max(500).optional(),
})), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return ApiResponse.error(res, 'Invalid application ID.', 400);
  const student = await Student.findOne({ userId: req.user._id });
  if (!student) return ApiResponse.error(res, 'Student profile not found.', 404);
  const application = await Application.findOne({ _id: req.params.id, studentId: student._id });
  if (!application) return ApiResponse.error(res, 'Application not found or you do not own it.', 404);
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
}));

module.exports = router;
