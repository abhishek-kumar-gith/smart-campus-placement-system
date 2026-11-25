const router = require('express').Router();
const { z } = require('zod');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  getInterviews,
  createInterview,
  updateInterviewStatus,
} = require('../controllers/interview.controller');

const interviewSchema = z.object({
  applicationId: z.string(),
  mode: z.enum(['Online', 'On-campus', 'Offline']).default('Online'),
  round: z.string().min(2),
  scheduledAt: z.coerce.date(),
  venue: z.string().optional(),
  meetingLink: z.string().optional(),
  instructions: z.string().max(2000).optional(),
});

router.get('/', protect, asyncHandler(getInterviews));
router.post('/', protect, authorize('admin', 'recruiter'), validate(interviewSchema), asyncHandler(createInterview));
router.patch('/:id/status', protect, authorize('admin', 'recruiter'), validate(z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']),
  feedback: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
  instructions: z.string().max(2000).optional(),
})), asyncHandler(updateInterviewStatus));
module.exports = router;
