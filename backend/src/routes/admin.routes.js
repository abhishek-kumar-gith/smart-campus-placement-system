const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const {
  getDashboard,
  getAnalytics,
  getStudents,
  getCompanies,
  getCompanyDetails,
  updateCompanyStatus,
  getJobs,
  getJobDetails,
  getApplications,
  getPlacedStudents,
  updateJobApproval,
  updateStudentPlacementStatus,
} = require('../controllers/admin.controller');

router.use(protect, authorize('admin'));

router.get('/dashboard', asyncHandler(getDashboard));
router.get('/analytics', asyncHandler(getAnalytics));
router.get('/students', asyncHandler(getStudents));
router.get('/companies', asyncHandler(getCompanies));
router.get('/companies/:id', asyncHandler(getCompanyDetails));
router.patch('/companies/:id/status', validate(z.object({
  status: z.enum(['active', 'inactive', 'pending']),
  remarks: z.string().trim().max(1000).optional(),
})), asyncHandler(updateCompanyStatus));
router.get('/jobs', asyncHandler(getJobs));
router.get('/jobs/:id', asyncHandler(getJobDetails));
router.get('/applications', asyncHandler(getApplications));
router.get('/placed-students', asyncHandler(getPlacedStudents));
router.patch('/jobs/:id/approval', validate(z.object({
  approvalStatus: z.enum(['draft', 'pending', 'approved', 'rejected']),
  remarks: z.string().trim().max(1000).optional(),
})), asyncHandler(updateJobApproval));

router.patch('/students/:id/placement-status', validate(z.object({
  placementStatus: z.enum([
    'unplaced',
    'placed',
    'opted-out',
    'higher-studies',
    'internship',
    'not-interested',
    'in-progress',
  ]),
  reason: z.string().trim().max(500).optional(),
  companyId: z.string().optional(),
  applicationId: z.string().optional(),
  jobId: z.string().optional(),
  placementDetails: z.string().trim().max(1000).optional(),
  package: z.coerce.number().min(0).optional(),
  monthlyStipend: z.coerce.number().min(0).optional(),
  offerDate: z.coerce.date().optional(),
  joiningDate: z.coerce.date().optional(),
  jobLocation: z.string().trim().optional(),
  jobRole: z.string().trim().optional(),
})), asyncHandler(updateStudentPlacementStatus));

module.exports = router;
