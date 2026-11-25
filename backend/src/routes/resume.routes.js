const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const {
  uploadResume: uploadResumeHandler,
  getResume,
  downloadResume,
} = require('../controllers/resume.controller');

router.post('/', protect, authorize('student'), uploadResume.single('resume'), asyncHandler(uploadResumeHandler));
router.get('/', protect, authorize('student'), asyncHandler(getResume));
router.get('/:id/download', protect, asyncHandler(downloadResume));

module.exports = router;
