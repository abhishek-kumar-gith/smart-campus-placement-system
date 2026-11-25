const router = require('express').Router();
const { z } = require('zod');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  createApplication,
  getApplications,
  updateApplicationStatus,
  withdrawApplication,
  downloadApplicationResume,
} = require('../controllers/application.controller');

router.post('/', protect, authorize('student'), validate(z.object({ jobId: z.string(), coverLetter: z.string().max(5000).optional() })), asyncHandler(createApplication));
router.get('/', protect, asyncHandler(getApplications));
router.get('/:id/resume', protect, asyncHandler(downloadApplicationResume));
router.patch('/:id/status', protect, authorize('admin', 'recruiter'), validate(z.object({ status: z.enum(['shortlisted', 'interview', 'selected', 'rejected', 'placed']), reason: z.string().max(500).optional(), feedback: z.string().max(2000).optional() })), asyncHandler(updateApplicationStatus));
router.patch('/:id/withdraw', protect, authorize('student'), validate(z.object({
  reason: z.string().trim().max(500).optional(),
})), asyncHandler(withdrawApplication));

module.exports = router;
