const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const { sendNotificationEmail } = require('../utils/email');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const Recruiter = require('../models/Recruiter.model');
const Notification = require('../models/Notification.model');
router.get('/', protect, (req, res) => ApiResponse.success(res, []));
router.post('/bulk', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { audience = 'students', subject, message } = req.body;
  if (!subject || !message) return ApiResponse.error(res, 'Subject and message are required.', 400);
  const students = audience === 'students' ? await Student.find().populate('userId', 'email') : [];
  if (audience === 'recruiters') {
    const users = await User.find({ role: 'recruiter', isActive: true });
    await Promise.all(users.map((user) => sendNotificationEmail(user.email, subject, `<p>${message}</p>`)));
    return ApiResponse.success(res, { recipients: users.length }, 'Bulk notification sent');
  }
  await Promise.all(students.map((student) => student.userId?.email ? sendNotificationEmail(student.userId.email, subject, `<p>${message}</p>`) : Promise.resolve()));
  return ApiResponse.success(res, { recipients: students.filter((student) => student.userId?.email).length }, 'Bulk notification sent');
}));

router.post('/send', protect, authorize('admin'), validate(z.object({
  recipientType: z.enum(['individual-student', 'individual-recruiter', 'multiple-students', 'multiple-recruiters']),
  recipientIds: z.array(z.string()).min(1).max(100),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(2).max(10000),
})), asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  if (req.body.recipientIds.some((id) => !mongoose.isValidObjectId(id))) {
    return ApiResponse.error(res, 'One or more recipient IDs are invalid.', 400);
  }
  let recipients = [];
  if (req.body.recipientType.includes('student')) {
    const students = await Student.find({ _id: { $in: req.body.recipientIds } }).populate('userId', 'email');
    recipients = students.map((student) => student.userId?.email).filter(Boolean);
  } else {
    const recruiters = await Recruiter.find({ _id: { $in: req.body.recipientIds } }).populate('userId', 'email');
    recipients = recruiters.map((recruiter) => recruiter.userId?.email).filter(Boolean);
  }
  if (!recipients.length) return ApiResponse.error(res, 'No valid recipients found.', 404);

  const results = await Promise.all(recipients.map(async (email) => ({
    email,
    result: await sendNotificationEmail(email, req.body.subject, `<div style="font-family:Arial,sans-serif;color:#1f2937"><h2>Smart Campus Placement</h2><p>${req.body.message.replace(/\n/g, '<br>')}</p><hr><p style="font-size:12px;color:#6b7280">Campus Placement Management System</p></div>`),
  })));
  const deliveredCount = results.filter((item) => item.result?.delivered).length;
  const failedCount = recipients.length - deliveredCount;
  await Notification.create({
    senderId: req.user._id,
    recipientType: req.body.recipientType.includes('student') ? (req.body.recipientIds.length === 1 ? 'student' : 'students') : (req.body.recipientIds.length === 1 ? 'recruiter' : 'recruiters'),
    recipientIds: req.body.recipientIds,
    recipientEmails: recipients,
    subject: req.body.subject,
    message: req.body.message,
    eventType: 'manual',
    status: failedCount === 0 ? 'sent' : deliveredCount === 0 ? 'failed' : 'partial',
    deliveredCount,
    failedCount,
    deliveryErrors: results.filter((item) => !item.result?.delivered).map((item) => item.email),
  });
  return ApiResponse.success(res, { recipients: recipients.length, deliveredCount, failedCount }, failedCount ? 'Notification sent with delivery failures' : 'Notification sent');
}));
module.exports = router;
