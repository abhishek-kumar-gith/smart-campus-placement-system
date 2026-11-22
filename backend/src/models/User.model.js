const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  name: { type: String, trim: true, default: '' },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin', 'recruiter'], required: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  refreshToken: { type: String, select: false },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

userSchema.index({ role: 1 });

module.exports = model('User', userSchema);
