const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Resume = require('../models/Resume.model');
const Student = require('../models/Student.model');
const { protect, authorize } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { extractSkills } = require('../services/skillExtractor');

router.post('/', protect, authorize('student'), uploadResume.single('resume'), asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  if (!req.file) return ApiResponse.error(res, 'Resume PDF is required.', 400);
  const buffer = fs.readFileSync(req.file.path);
  const parsed = await pdfParse(buffer);
  const extractedSkills = extractSkills(parsed.text);
  const resume = await Resume.findOneAndUpdate({ studentId: student._id }, {
    studentId: student._id, userId: req.user._id, fileUrl: `/uploads/resumes/${path.basename(req.file.path)}`,
    fileName: req.file.originalname, fileSize: req.file.size, parsedText: parsed.text, extractedSkills,
    parsingStatus: 'completed', lastParsedAt: new Date(),
  }, { upsert: true, new: true, runValidators: true });
  await Student.findByIdAndUpdate(student._id, { $addToSet: { skills: { $each: extractedSkills } } });
  return ApiResponse.success(res, resume, 'Resume uploaded and parsed', 201);
}));
router.get('/', protect, authorize('student'), asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id });
  return ApiResponse.success(res, await Resume.findOne({ studentId: student._id }));
}));

module.exports = router;
