const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Resume = require('../models/Resume.model');
const Student = require('../models/Student.model');
const ApiResponse = require('../utils/apiResponse');
const { extractSkills } = require('../services/skillExtractor');
const Application = require('../models/Application.model');
const Recruiter = require('../models/Recruiter.model');
const Job = require('../models/Job.model');
const mongoose = require('mongoose');

const uploadResume = async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  if (!req.file) return ApiResponse.error(res, 'Resume PDF is required.', 400);
  const buffer = fs.readFileSync(req.file.path);
  const parsed = await pdfParse(buffer);
  const extractedSkills = extractSkills(parsed.text);
  const resume = await Resume.findOneAndUpdate(
    { studentId: student._id },
    {
      studentId: student._id,
      userId: req.user._id,
      fileUrl: `/uploads/resumes/${path.basename(req.file.path)}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      parsedText: parsed.text,
      extractedSkills,
      parsingStatus: 'completed',
      lastParsedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true },
  );
  await Student.findByIdAndUpdate(
    student._id,
    { $addToSet: { skills: { $each: extractedSkills } } },
  );
  return ApiResponse.success(res, resume, 'Resume uploaded and parsed', 201);
};

const getResume = async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  return ApiResponse.success(res, await Resume.findOne({ studentId: student._id }));
};

const downloadResume = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid resume ID.', 400);
  }
  const resume = await Resume.findById(req.params.id);
  if (!resume) return ApiResponse.error(res, 'Resume not found.', 404);

  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student || String(resume.studentId) !== String(student._id)) {
      return ApiResponse.error(res, 'You cannot download another student resume.', 403);
    }
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved') {
      return ApiResponse.error(res, 'Recruiter account is not approved.', 403);
    }
    const application = await Application.findOne({
      studentId: resume.studentId,
      companyId: recruiter.companyId,
      status: { $ne: 'withdrawn' },
    }).select('jobId');
    if (!application) {
      return ApiResponse.error(res, 'You cannot download this resume.', 403);
    }
    const ownJob = await Job.findOne({
      _id: application.jobId,
      createdBy: req.user._id,
    }).select('_id');
    if (!ownJob) {
      return ApiResponse.error(res, 'You cannot download this resume.', 403);
    }
  } else if (req.user.role !== 'admin') {
    return ApiResponse.error(res, 'Access denied.', 403);
  }

  const filePath = path.join(
    __dirname,
    '../../uploads/resumes',
    path.basename(resume.fileUrl),
  );
  if (!fs.existsSync(filePath)) {
    return ApiResponse.error(res, 'Resume file not found.', 404);
  }
  return res.download(filePath, resume.fileName);
};

module.exports = { uploadResume, getResume, downloadResume };
