const Notification = require('../../models/Notification.model');

const createUserNotification = ({
  senderId,
  recipientUserId,
  subject,
  message,
  eventType,
}) => Notification.create({
  senderId,
  recipientType: 'student',
  recipientIds: [recipientUserId],
  subject,
  message,
  eventType,
  status: 'sent',
  deliveredCount: 1,
  failedCount: 0,
});

module.exports = { createUserNotification };
