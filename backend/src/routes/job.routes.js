const router = require('express').Router();
const { z } = require('zod');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { optionalProtect } = require('../middleware/auth');
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJob,
} = require('../controllers/job.controller');

const jobShape = z.object({
  companyId: z.string().optional(),
  title: z.string().trim().min(2, 'Job title must have at least 2 characters'),
  description: z.string().trim().min(10, 'Job description must have at least 10 characters'),
  location: z.string().trim().min(2, 'Location must have at least 2 characters'),
  requiredExperience: z.string().trim().optional(),
  package: z.object({ min: z.coerce.number().min(0).optional(), max: z.coerce.number().min(0).optional(), currency: z.string().optional() }).optional(),
  jobType: z.enum(['Full-time', 'Internship', 'Contract']).optional(), requiredSkills: z.array(z.string()).default([]),
  minCgpa: z.coerce.number().min(0).max(10).default(0),
  allowedBranches: z.array(z.string().trim().min(1))
    .transform((branches) => [...new Set(branches)])
    .refine((branches) => branches.length > 0, 'Select at least one eligible branch')
    .refine((branches) => !branches.includes('Other'), 'Other must not be used as a wildcard eligible branch')
    .default([]),
  targetGraduationYear: z.coerce.number().int(), maxBacklogs: z.coerce.number().int().min(0).default(0),
  targetSemester: z.coerce.number().int().min(1).max(8).optional(),
  allowedSemesters: z.array(z.coerce.number().int().min(1).max(8)).optional(),
  vacancies: z.coerce.number().int().min(1),
  publishDate: z.coerce.date(),
  applicationDeadline: z.coerce.date().refine((date) => date.getTime() > Date.now(), 'Application deadline must be a future date'),
});
const jobSchema = jobShape.superRefine((drive, ctx) => {
  if (drive.applicationDeadline.getTime() < drive.publishDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['applicationDeadline'],
      message: 'Application deadline cannot be earlier than the drive post date',
    });
  }
});

router.get('/', optionalProtect, asyncHandler(getJobs));
router.get('/browse', optionalProtect, asyncHandler(getJobs));
router.get('/:id', optionalProtect, asyncHandler(getJob));
router.post('/', protect, authorize('admin', 'recruiter'), validate(jobSchema), asyncHandler(createJob));

const editableJobSchema = jobShape.partial();

router.patch('/:id', protect, authorize('recruiter'), validate(editableJobSchema), asyncHandler(updateJob));

router.patch('/:id/status', protect, authorize('recruiter'), validate(z.object({
  status: z.enum(['draft', 'pending', 'active', 'inactive', 'closed', 'cancelled']),
})), asyncHandler(updateJobStatus));

router.delete('/:id', protect, authorize('recruiter'), asyncHandler(deleteJob));

module.exports = router;
