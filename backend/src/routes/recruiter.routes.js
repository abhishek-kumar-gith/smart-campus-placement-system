const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const {
  getProfile, getRecruiters, updateApproval, getDashboard, getRecruiterApplications,
  getEligibleStudents, getCompanyProfile, updateCompanyProfile,
} = require('../controllers/recruiter.controller');

router.get('/profile', protect, authorize('recruiter'), asyncHandler(getProfile));
router.get('/dashboard', protect, authorize('recruiter'), asyncHandler(getDashboard));
router.get('/applications', protect, authorize('recruiter'), asyncHandler(getRecruiterApplications));
router.get('/students', protect, authorize('recruiter'), asyncHandler(getEligibleStudents));
router.get('/company', protect, authorize('recruiter'), asyncHandler(getCompanyProfile));
router.patch('/company', protect, authorize('recruiter'), validate(z.object({
  website: z.string().url().or(z.literal('')).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().min(1).max(200).optional(),
  hrName: z.string().min(1).max(150).optional(),
  hrEmail: z.string().email().optional(),
  contactNumber: z.string().min(7).max(30).optional(),
}).strict()), asyncHandler(updateCompanyProfile));
router.get('/', protect, authorize('admin'), asyncHandler(getRecruiters));
router.patch('/:id/approval', protect, authorize('admin'), validate(z.object({
  approvalStatus: z.enum(['pending', 'approved', 'rejected']),
})), asyncHandler(updateApproval));

module.exports = router;
