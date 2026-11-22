const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Recruiter = require('../models/Recruiter.model');
const Company = require('../models/Company.model');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const crypto = require('crypto');
const PendingRegistration = require('../models/PendingRegistration.model');
const { sendOtpEmail } = require('../utils/email');
const { authLimiter } = require('../middleware/rateLimiter');

const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });
const studentRegistration = credentials.extend({
  fullName: z.string().min(2), rollNumber: z.string().min(2), phone: z.string().min(7),
  branch: z.string(), degree: z.string(), currentSemester: z.coerce.number().int().min(1).max(8),
  cgpa: z.coerce.number().min(0).max(10), graduationYear: z.coerce.number().int(),
});
const recruiterRegistration = credentials.extend({
  fullName: z.string().min(2), designation: z.string().min(2), phone: z.string().min(7),
  companyId: z.string().optional(),
  companyName: z.string().min(2).optional(),
  industry: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  website: z.string().optional(),
  hrName: z.string().min(2).optional(),
  hrEmail: z.string().email().optional(),
  contactNumber: z.string().min(7).optional(),
});
const issueTokens = (user) => ({
  accessToken: generateAccessToken({ id: user._id.toString(), role: user.role }),
  refreshToken: generateRefreshToken({ id: user._id.toString(), role: user.role }),
});

const otpHash = (otp) => crypto.createHash('sha256').update(otp).digest('hex');
const generateOtp = () => String(crypto.randomInt(100000, 1000000));

router.use('/register', authLimiter);
router.use('/otp', authLimiter);

router.post('/register/student', validate(studentRegistration), asyncHandler(async (req, res) => {
  const { email, password, ...profile } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) return ApiResponse.error(res, 'A user with this email already exists.', 409);
  const normalizedEmail = email.toLowerCase();
  const existingPending = await PendingRegistration.findOne({ email: normalizedEmail });
  if (existingPending) return ApiResponse.error(res, 'A registration verification is already pending for this email.', 409);
  const otp = generateOtp();
  await PendingRegistration.create({
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'student',
    profile,
    otpHash: otpHash(otp),
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    resendAvailableAt: new Date(Date.now() + 60 * 1000),
  });
  await sendOtpEmail(normalizedEmail, otp);
  return ApiResponse.success(res, { email: normalizedEmail, verificationRequired: true, expiresInSeconds: 600 }, 'OTP sent to your email', 201);
}));

router.post('/register/recruiter', validate(recruiterRegistration), asyncHandler(async (req, res) => {
  const { email, password, companyId, companyName, industry, location, website, hrName, hrEmail, contactNumber, ...profile } = req.body;
  const normalizedEmail = email.toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) return ApiResponse.error(res, 'A user with this email already exists.', 409);
  const existingPending = await PendingRegistration.findOne({ email: normalizedEmail });
  if (existingPending) return ApiResponse.error(res, 'A registration verification is already pending for this email.', 409);
  const otp = generateOtp();
  await PendingRegistration.create({
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'recruiter',
    profile: { ...profile, companyId, companyName, industry, location, website, hrName, hrEmail, contactNumber },
    otpHash: otpHash(otp),
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    resendAvailableAt: new Date(Date.now() + 60 * 1000),
  });
  await sendOtpEmail(normalizedEmail, otp);
  return ApiResponse.success(res, { email: normalizedEmail, verificationRequired: true, expiresInSeconds: 600 }, 'OTP sent to your email', 201);
}));

router.post('/otp/verify', validate(z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
})), asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const pending = await PendingRegistration.findOne({ email }).select('+passwordHash +otpHash');
  if (!pending) return ApiResponse.error(res, 'No pending registration found for this email.', 404);
  if (pending.otpExpiresAt.getTime() < Date.now()) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    return ApiResponse.error(res, 'OTP has expired. Please register again.', 410);
  }
  if (pending.failedAttempts >= 5) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    return ApiResponse.error(res, 'Maximum OTP attempts exceeded. Please register again.', 429);
  }
  if (otpHash(req.body.otp) !== pending.otpHash) {
    pending.failedAttempts += 1;
    await pending.save();
    return ApiResponse.error(res, 'Invalid OTP.', 401, { attemptsRemaining: Math.max(0, 5 - pending.failedAttempts) });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    return ApiResponse.error(res, 'A user with this email already exists.', 409);
  }

  let user;
  try {
    user = await User.create({
      name: pending.profile.fullName || '',
      email,
      passwordHash: pending.passwordHash,
      role: pending.role,
      isEmailVerified: true,
      isActive: true,
    });

    if (pending.role === 'student') {
      await Student.create({ userId: user._id, ...pending.profile });
    } else {
      const profile = pending.profile;
      let linkedCompanyId = profile.companyId || null;
      if (!linkedCompanyId && profile.companyName) {
        const company = await Company.findOneAndUpdate(
          { name: profile.companyName.trim() },
          {
            name: profile.companyName.trim(),
            industry: profile.industry || 'Other',
            location: profile.location || 'Not specified',
            website: profile.website || '',
            hrName: profile.hrName || profile.fullName,
            hrEmail: profile.hrEmail || email,
            contactNumber: profile.contactNumber || profile.phone,
            addedBy: user._id,
            status: 'pending',
          },
          { upsert: true, new: true, runValidators: true },
        );
        linkedCompanyId = company._id;
      }
      await Recruiter.create({
        userId: user._id,
        fullName: profile.fullName,
        designation: profile.designation,
        phone: profile.phone,
        companyId: linkedCompanyId,
        approvalStatus: 'pending',
      });
    }
  } catch (error) {
    if (user) await User.findByIdAndDelete(user._id);
    throw error;
  }

  await PendingRegistration.deleteOne({ _id: pending._id });
  return ApiResponse.success(res, { user: { id: user._id, email, role: user.role }, verificationRequired: false }, 'Email verified and registration completed', 200);
}));

router.post('/otp/resend', validate(z.object({ email: z.string().email() })), asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const pending = await PendingRegistration.findOne({ email }).select('+passwordHash +otpHash');
  if (!pending) return ApiResponse.error(res, 'No pending registration found for this email.', 404);
  if (pending.otpExpiresAt.getTime() < Date.now()) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    return ApiResponse.error(res, 'OTP has expired. Please register again.', 410);
  }
  const retryAfter = pending.resendAvailableAt.getTime() - Date.now();
  if (retryAfter > 0) {
    return ApiResponse.error(res, 'Please wait before requesting another OTP.', 429, { retryAfterSeconds: Math.ceil(retryAfter / 1000) });
  }
  const otp = generateOtp();
  pending.otpHash = otpHash(otp);
  pending.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  pending.resendAvailableAt = new Date(Date.now() + 60 * 1000);
  pending.failedAttempts = 0;
  await pending.save();
  await sendOtpEmail(email, otp);
  return ApiResponse.success(res, { email, expiresInSeconds: 600, retryAfterSeconds: 60 }, 'A new OTP has been sent');
}));

router.post('/login', validate(credentials), asyncHandler(async (req, res) => {
  const pending = await PendingRegistration.findOne({ email: req.body.email.toLowerCase() });
  if (pending) return ApiResponse.error(res, 'Email verification is pending. Please verify the OTP before login.', 403);
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return ApiResponse.error(res, 'Invalid email or password.', 401);
  user.lastLogin = new Date();
  await user.save();
  return ApiResponse.success(res, { user: { id: user._id, email: user.email, role: user.role }, ...issueTokens(user) }, 'Login successful');
}));

router.get('/me', protect, asyncHandler(async (req, res) => {
  let profile = null;
  if (req.user.role === 'student') profile = await Student.findOne({ userId: req.user._id });
  if (req.user.role === 'recruiter') profile = await Recruiter.findOne({ userId: req.user._id }).populate('companyId');
  return ApiResponse.success(res, { user: { id: req.user._id, email: req.user.email, role: req.user.role }, profile });
}));

module.exports = router;
