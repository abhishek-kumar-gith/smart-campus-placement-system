const { Schema, model } = require('mongoose');

const pendingRegistrationSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'recruiter'], required: true },
  profile: { type: Schema.Types.Mixed, required: true },
  otpHash: { type: String, required: true, select: false },
  otpExpiresAt: { type: Date, required: true },
  resendAvailableAt: { type: Date, required: true },
  failedAttempts: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

pendingRegistrationSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('PendingRegistration', pendingRegistrationSchema);
