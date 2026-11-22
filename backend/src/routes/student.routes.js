const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const Student = require('../models/Student.model');
const Job = require('../models/Job.model');
const Application = require('../models/Application.model');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { rankJobsForStudent } = require('../services/recommendationEngine');
const { uploadProfilePhoto } = require('../middleware/upload');

const profileSchema = z.object({
  fullName: z.string().min(2).optional(), phone: z.string().min(7).optional(), branch: z.string().optional(), degree: z.string().optional(),
  currentSemester: z.coerce.number().int().min(1).max(8).optional(), cgpa: z.coerce.number().min(0).max(10).optional(),
  graduationYear: z.coerce.number().int().optional(), backlogs: z.object({ count: z.coerce.number().int().min(0), details: z.string().optional() }).optional(),
  skills: z.array(z.string().min(1)).optional(),
}).strict();

router.use(protect, authorize('student'));
router.get('/profile', asyncHandler(async (req, res) => ApiResponse.success(res, await Student.findOne({ userId: req.user._id }))));
router.patch('/profile', validate(profileSchema), asyncHandler(async (req, res) => ApiResponse.success(res, await Student.findOneAndUpdate({ userId: req.user._id }, req.body, { new: true, runValidators: true }), 'Profile updated')));
router.post('/profile/photo', uploadProfilePhoto.single('photo'), asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  if (!student) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return ApiResponse.error(res, 'Student profile not found.', 404);
  }
  if (!req.file) return ApiResponse.error(res, 'Profile photo is required.', 400);

  const oldUrl = student.profilePhotoUrl;
  const profilePhotoUrl = `/uploads/profile-photos/${path.basename(req.file.path)}`;
  student.profilePhotoUrl = profilePhotoUrl;
  try {
    await student.save();
  } catch (error) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    throw error;
  }

  if (oldUrl?.startsWith('/uploads/profile-photos/')) {
    const oldPath = path.join(__dirname, '../../uploads/profile-photos', path.basename(oldUrl));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  return ApiResponse.success(res, { profilePhotoUrl }, 'Profile photo uploaded', 201);
}));
router.get('/recommendations', asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  const jobs = await Job.find({
    isPublished: true,
    approvalStatus: 'approved',
    status: 'active',
    applicationDeadline: { $gte: new Date() },
    $or: [{ publishDate: null }, { publishDate: { $lte: new Date() } }],
  }).populate('companyId', 'name logo');
  return ApiResponse.success(res, rankJobsForStudent(student, jobs));
}));
router.get('/applications', asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  return ApiResponse.success(res, await Application.find({ studentId: student._id }).populate('jobId companyId'));
}));

module.exports = router;
