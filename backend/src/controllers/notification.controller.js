const { protect, authorize } = require('../middleware/auth');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Recruiter = require('../models/Recruiter.model');
const Notification = require('../models/Notification.model');
const { sendNotificationEmail } = require('../utils/email');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const getNotifications = async (req, res) => {
  const recipients = [req.user._id];
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id }).select('_id');
    if (student) recipients.push(student._id);
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id }).select('_id');
    if (recruiter) recipients.push(recruiter._id);
  }
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const filter = req.user.role === 'admin'
    ? { senderId: req.user._id }
    : { recipientIds: { $in: recipients } };
  const unreadFilter = {
    ...filter,
    $or: [{ isRead: false }, { isRead: { $exists: false } }],
  };
  if (req.query.unread === 'true') Object.assign(filter, unreadFilter);
  const [records, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 })
      .skip((page - 1) * pageSize).limit(pageSize).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments(unreadFilter),
  ]);
  return ApiResponse.success(res, {
    records: records.map((record) => ({ ...record, isRead: Boolean(record.isRead) })),
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    unread,
  });
};

const markNotificationRead = async (req, res) => {
  const mongoose = require('mongoose');
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid notification ID.', 400);
  }
  const recipients = [req.user._id];
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id }).select('_id');
    if (student) recipients.push(student._id);
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id }).select('_id');
    if (recruiter) recipients.push(recruiter._id);
  }
  const filter = req.user.role === 'admin'
    ? { _id: req.params.id, senderId: req.user._id }
    : { _id: req.params.id, recipientIds: { $in: recipients } };
  const notification = await Notification.findOneAndUpdate(
    filter,
    { $set: { isRead: true, readAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!notification) return ApiResponse.error(res, 'Notification not found.', 404);
  return ApiResponse.success(res, notification, 'Notification marked as read');
};

const sendBulkNotification = async (req, res) => {
  const { audience = 'students', subject, message } = req.body;
  if (!subject || !message) return ApiResponse.error(res, 'Subject and message are required.', 400);
  let users = [];
  let recipientType;
  if (audience === 'recruiters') {
    users = await User.find({ role: 'recruiter', isActive: true }).select('_id email');
    recipientType = 'recruiter';
  } else {
    const students = await Student.find().populate('userId', 'email isActive');
    users = students.map((student) => student.userId).filter((user) => user?.isActive && user.email);
    recipientType = 'student';
  }
  const results = await Promise.all(users.map(async (user) => ({
    user,
    result: await sendNotificationEmail(user.email, subject, `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`),
  })));
  const deliveredCount = results.filter(({ result }) => result?.delivered).length;
  const failedCount = users.length - deliveredCount;
  if (users.length) {
    await Notification.insertMany(results.map(({ user, result }) => ({
      senderId: req.user._id,
      recipientType,
      recipientIds: [user._id],
      recipientEmails: [user.email],
      subject,
      message,
      eventType: 'manual',
      status: result?.delivered ? 'sent' : 'failed',
      deliveredCount: result?.delivered ? 1 : 0,
      failedCount: result?.delivered ? 0 : 1,
      deliveryErrors: result?.delivered ? [] : [user.email],
    })));
  }
  return ApiResponse.success(
    res,
    { recipients: users.length, deliveredCount, failedCount },
    failedCount ? 'Bulk notification completed with delivery failures' : 'Bulk notification sent',
  );
};

const sendNotification = async (req, res) => {
  const mongoose = require('mongoose');
  if (req.body.recipientIds.some((id) => !mongoose.isValidObjectId(id))) {
    return ApiResponse.error(res, 'One or more recipient IDs are invalid.', 400);
  }
  let recipients = [];
  if (req.body.recipientType.includes('student')) {
    const students = await Student.find({ _id: { $in: req.body.recipientIds } }).populate('userId', 'email');
    recipients = students.map((student) => student.userId).filter((user) => user?.email);
  } else {
    const recruiters = await Recruiter.find({ _id: { $in: req.body.recipientIds } }).populate('userId', 'email');
    recipients = recruiters.map((recruiter) => recruiter.userId).filter((user) => user?.email);
  }
  if (!recipients.length) return ApiResponse.error(res, 'No valid recipients found.', 404);

  const results = await Promise.all(recipients.map(async (user) => ({
    user,
    result: await sendNotificationEmail(
      user.email,
      req.body.subject,
      `<div style="font-family:Arial,sans-serif;color:#1f2937"><h2>DCRUST Placement Portal</h2><p>${escapeHtml(req.body.message).replace(/\n/g, '<br>')}</p><hr><p style="font-size:12px;color:#6b7280">University Placement Management System</p></div>`,
    ),
  })));
  const deliveredCount = results.filter((item) => item.result?.delivered).length;
  const failedCount = recipients.length - deliveredCount;
  await Notification.insertMany(results.map(({ user, result }) => ({
    senderId: req.user._id,
    recipientType: req.body.recipientType.includes('student') ? 'student' : 'recruiter',
    recipientIds: [user._id],
    recipientEmails: [user.email],
    subject: req.body.subject,
    message: req.body.message,
    eventType: 'manual',
    status: result?.delivered ? 'sent' : 'failed',
    deliveredCount: result?.delivered ? 1 : 0,
    failedCount: result?.delivered ? 0 : 1,
    deliveryErrors: result?.delivered ? [] : [user.email],
  })));
  return ApiResponse.success(
    res,
    { recipients: recipients.length, deliveredCount, failedCount },
    failedCount ? 'Notification sent with delivery failures' : 'Notification sent',
  );
};

module.exports = {
  getNotifications,
  markNotificationRead,
  sendBulkNotification,
  sendNotification,
};
