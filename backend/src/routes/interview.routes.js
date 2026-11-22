const router = require('express').Router();
const { z } = require('zod');
const Interview = require('../models/Interview.model');
const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const Recruiter = require('../models/Recruiter.model');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { sendNotificationEmail } = require('../utils/email');
const User = require('../models/User.model');

const interviewSchema = z.object({
  applicationId: z.string(),
  mode: z.enum(['Online', 'On-campus', 'Offline']).default('Online'),
  round: z.string().min(2),
  scheduledAt: z.coerce.date(),
  venue: z.string().optional(),
  meetingLink: z.string().optional(),
  instructions: z.string().max(2000).optional(),
});

router.get('/', protect, asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    filter.studentId = student?._id;
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    filter.companyId = recruiter?.companyId || null;
  }
  return ApiResponse.success(res, await Interview.find(filter).populate('applicationId studentId jobId companyId').sort({ scheduledAt: 1 }));
}));
router.post('/', protect, authorize('admin', 'recruiter'), validate(interviewSchema), asyncHandler(async (req, res) => {
  const application = await Application.findById(req.body.applicationId);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || String(recruiter.companyId) !== String(application.companyId)) {
      return ApiResponse.error(res, 'You cannot schedule interviews for another company.', 403);
    }
  }
  const interview = await Interview.findOneAndUpdate(
    { applicationId: application._id },
    {
      applicationId: application._id,
      studentId: application.studentId,
      jobId: application.jobId,
      companyId: application.companyId,
      createdBy: req.user._id,
      ...req.body,
    },
    { upsert: true, new: true, runValidators: true },
  );
  application.status = 'interview';
  application.statusHistory.push({ status: 'interview', changedBy: req.user._id, changedByRole: req.user.role, reason: 'Interview scheduled' });
  await application.save();
  const student = await Student.findById(application.studentId).populate('userId', 'email');
  if (student?.userId?.email) {
    await sendNotificationEmail(student.userId.email, 'Interview Scheduled', `<h2>Smart Campus Placement</h2><p>An interview has been scheduled for <strong>${interview.round}</strong>.</p><p>Date: ${new Date(interview.scheduledAt).toLocaleString()}</p><p>Mode: ${interview.mode}</p>${interview.instructions ? `<p>Instructions: ${interview.instructions}</p>` : ''}`);
  }
  return ApiResponse.success(res, interview, 'Interview scheduled', 201);
}));
router.patch('/:id/status', protect, authorize('admin', 'recruiter'), validate(z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']),
  feedback: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
  instructions: z.string().max(2000).optional(),
})), asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return ApiResponse.error(res, 'Interview not found.', 404);
  if (req.body.status === 'rescheduled' && req.body.scheduledAt) {
    interview.rescheduleHistory.push({ previousScheduledAt: interview.scheduledAt, newScheduledAt: req.body.scheduledAt, changedBy: req.user._id });
    interview.scheduledAt = req.body.scheduledAt;
  }
  interview.status = req.body.status;
  interview.feedback = req.body.feedback || interview.feedback;
  interview.instructions = req.body.instructions || interview.instructions;
  await interview.save();
  return ApiResponse.success(res, interview, 'Interview status updated');
}));
module.exports = router;
