const Interview = require('../models/Interview.model');
const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const Recruiter = require('../models/Recruiter.model');
const Job = require('../models/Job.model');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');
const { sendNotificationEmail } = require('../utils/email');
const { createUserNotification } = require('../services/notificationService');

const getInterviews = async (req, res) => {
  let filter = {};
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    filter.studentId = student?._id;
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved') {
      return ApiResponse.error(res, 'Recruiter account is not approved.', 403);
    }
    const jobs = await Job.find({ createdBy: req.user._id, companyId: recruiter.companyId }).select('_id');
    filter.companyId = recruiter.companyId;
    filter.jobId = { $in: jobs.map((job) => job._id) };
  }
  if (req.query.status) filter.status = req.query.status;
  const query = Interview.find(filter)
    .populate({
      path: 'applicationId',
      populate: { path: 'jobId companyId studentId' },
    })
    .populate('studentId jobId companyId')
    .sort({ scheduledAt: 1 });
  if (req.query.page || req.query.pageSize) {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const [records, total] = await Promise.all([
      query.skip((page - 1) * pageSize).limit(pageSize),
      Interview.countDocuments(filter),
    ]);
    return ApiResponse.success(res, {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
  return ApiResponse.success(res, await query);
};

const createInterview = async (req, res) => {
  const application = await Application.findById(req.body.applicationId);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved' || String(recruiter.companyId) !== String(application.companyId)) {
      return ApiResponse.error(res, 'You cannot schedule interviews for another company.', 403);
    }
    const ownJob = await Job.findOne({
      _id: application.jobId,
      createdBy: req.user._id,
    }).select('_id');
    if (!ownJob) {
      return ApiResponse.error(res, 'You cannot schedule interviews for another recruiter drive.', 403);
    }
  }
  const existingRound = await Interview.findOne({
    applicationId: application._id,
    round: req.body.round,
  });
  if (existingRound) {
    return ApiResponse.error(
      res,
      'An interview round with this name already exists for this application.',
      409,
    );
  }
  let interview;
  try {
    interview = await Interview.create({
      applicationId: application._id,
      studentId: application.studentId,
      jobId: application.jobId,
      companyId: application.companyId,
      createdBy: req.user._id,
      ...req.body,
    });
  } catch (error) {
    if (error.code === 11000) {
      return ApiResponse.error(
        res,
        'An interview round with this name already exists for this application.',
        409,
      );
    }
    throw error;
  }
  application.status = 'interview';
  application.statusHistory.push({
    status: 'interview',
    changedBy: req.user._id,
    changedByRole: req.user.role,
    reason: 'Interview scheduled',
  });
  await application.save();
  const student = await Student.findById(application.studentId).populate('userId', 'email');
  if (student?.userId?._id) {
    await createUserNotification({
      senderId: req.user._id,
      recipientUserId: student.userId._id,
      subject: 'Interview scheduled',
      message: `An interview has been scheduled for ${interview.round} on ${new Date(interview.scheduledAt).toLocaleString()}.`,
      eventType: 'interview',
    });
  }
  if (student?.userId?.email) {
    await sendNotificationEmail(
      student.userId.email,
      'Interview Scheduled',
      `<h2>DCRUST Placement Portal</h2><p>An interview has been scheduled for <strong>${interview.round}</strong>.</p><p>Date: ${new Date(interview.scheduledAt).toLocaleString()}</p><p>Mode: ${interview.mode}</p>${interview.instructions ? `<p>Instructions: ${interview.instructions}</p>` : ''}`,
    );
  }
  return ApiResponse.success(res, interview, 'Interview scheduled', 201);
};

const updateInterviewStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid interview ID.', 400);
  }
  const interview = await Interview.findById(req.params.id);
  if (!interview) return ApiResponse.error(res, 'Interview not found.', 404);
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    const ownJob = recruiter?.companyId && interview.jobId
      ? await Job.findOne({ _id: interview.jobId, companyId: recruiter.companyId, createdBy: req.user._id }).select('_id')
      : null;
    const legacyOwnerMatch = !interview.jobId && String(interview.createdBy) === String(req.user._id);
    if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved' || String(recruiter.companyId) !== String(interview.companyId) || (!ownJob && !legacyOwnerMatch)) return ApiResponse.error(res, 'You cannot update another recruiter interview.', 403);
  }
  if (req.body.status === 'rescheduled' && req.body.scheduledAt) {
    interview.rescheduleHistory.push({
      previousScheduledAt: interview.scheduledAt,
      newScheduledAt: req.body.scheduledAt,
      changedBy: req.user._id,
    });
    interview.scheduledAt = req.body.scheduledAt;
  }
  interview.status = req.body.status;
  interview.feedback = req.body.feedback || interview.feedback;
  interview.instructions = req.body.instructions || interview.instructions;
  await interview.save();
  const student = await Student.findById(interview.studentId).select('userId');
  if (student?.userId) {
    await createUserNotification({
      senderId: req.user._id,
      recipientUserId: student.userId,
      subject: 'Interview updated',
      message: `Your ${interview.round} interview status is ${interview.status}.${interview.status === 'rescheduled' ? ` New time: ${new Date(interview.scheduledAt).toLocaleString()}.` : ''}`,
      eventType: 'interview',
    });
  }
  return ApiResponse.success(res, interview, 'Interview status updated');
};

module.exports = { getInterviews, createInterview, updateInterviewStatus };
