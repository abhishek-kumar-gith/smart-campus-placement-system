const { Schema, model } = require('mongoose');

const notificationSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipientType: { type: String, enum: ['student', 'recruiter', 'students', 'recruiters'], required: true },
  recipientIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  recipientEmails: [{ type: String }],
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  eventType: { type: String, default: 'manual' },
  status: { type: String, enum: ['sent', 'partial', 'failed'], required: true },
  deliveredCount: { type: Number, default: 0, min: 0 },
  failedCount: { type: Number, default: 0, min: 0 },
  deliveryErrors: [{ type: String }],
}, { timestamps: true });

notificationSchema.index({ senderId: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = model('Notification', notificationSchema);
