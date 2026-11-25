const fs = require('fs');
const path = require('path');
const Student = require('../models/Student.model');
const Job = require('../models/Job.model');
const Application = require('../models/Application.model');
const ApiResponse = require('../utils/apiResponse');
const { rankJobsForStudent } = require('../services/recommendationEngine');

const getProfile = async (req, res) => {
  return ApiResponse.success(res, await Student.findOne({ userId: req.user._id }));
};

const updateProfile = async (req, res) => {
  return ApiResponse.success(
    res,
    await Student.findOneAndUpdate(
      { userId: req.user._id },
      req.body,
      { new: true, runValidators: true },
    ),
    'Profile updated',
  );
};

const uploadProfilePhoto = async (req, res) => {
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
};

const getRecommendations = async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  const jobs = await Job.find({
    isPublished: true,
    approvalStatus: 'approved',
    status: 'active',
    applicationDeadline: { $gte: new Date() },
    $or: [{ publishDate: null }, { publishDate: { $lte: new Date() } }],
  }).populate('companyId', 'name logo');
  return ApiResponse.success(res, rankJobsForStudent(student, jobs));
};

const getApplications = async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  return ApiResponse.success(
    res,
    await Application.find({ studentId: student._id }).populate('jobId companyId'),
  );
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getRecommendations,
  getApplications,
};
