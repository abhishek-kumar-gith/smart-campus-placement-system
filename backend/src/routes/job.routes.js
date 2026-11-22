const router = require('express').Router();
const { z } = require('zod');
const Job = require('../models/Job.model');
const Recruiter = require('../models/Recruiter.model');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const Application = require('../models/Application.model');
const mongoose = require('mongoose');
const Student = require('../models/Student.model');
const { optionalProtect } = require('../middleware/auth');
const { checkEligibility } = require('../services/eligibilityEngine');

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

router.get('/', optionalProtect, asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : {
    isPublished: true,
    approvalStatus: 'approved',
    status: 'active',
    applicationDeadline: { $gte: new Date() },
    $or: [{ publishDate: null }, { publishDate: { $lte: new Date() } }],
  };
  const jobs = await Job.find(filter).populate('companyId', 'name logo industry location').sort({ createdAt: -1 });
  if (req.user?.role !== 'student') {
    return ApiResponse.success(res, jobs);
  }
  const student = await Student.findOne({ userId: req.user._id });
  const data = jobs.map((job) => ({
    ...job.toObject(),
    eligibility: checkEligibility(student, job),
  }));
  return ApiResponse.success(res, data);
}));
router.get('/:id', asyncHandler(async (req, res) => ApiResponse.success(res, await Job.findById(req.params.id).populate('companyId'))));
router.post('/', protect, authorize('admin', 'recruiter'), validate(jobSchema), asyncHandler(async (req, res) => {
  let companyId = req.body.companyId;
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId) return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
    if (recruiter.approvalStatus !== 'approved') return ApiResponse.error(res, 'Recruiter account is awaiting approval.', 403);
    companyId = recruiter.companyId;
  }
  const job = await Job.create({ ...req.body, companyId, createdBy: req.user._id, createdByRole: req.user.role, approvalStatus: req.user.role === 'admin' ? 'approved' : 'pending', status: req.user.role === 'admin' ? 'active' : 'pending', isPublished: req.user.role === 'admin' });
  return ApiResponse.success(res, job, 'Job created', 201);
}));

const editableJobSchema = jobShape.partial();

router.patch('/:id', protect, authorize('recruiter'), validate(editableJobSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return ApiResponse.error(res, 'Invalid drive ID.', 400);
  const recruiter = await Recruiter.findOne({ userId: req.user._id });
  if (!recruiter?.companyId) return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
  if (recruiter.approvalStatus !== 'approved') return ApiResponse.error(res, 'Recruiter account is awaiting approval.', 403);
  const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!job) return ApiResponse.error(res, 'Drive not found or you do not own it.', 404);
  if (job.status === 'closed' || job.status === 'cancelled') return ApiResponse.error(res, 'Closed or cancelled drives cannot be modified.', 409);

  const publishDate = req.body.publishDate ? new Date(req.body.publishDate) : job.publishDate;
  const applicationDeadline = req.body.applicationDeadline ? new Date(req.body.applicationDeadline) : job.applicationDeadline;
  if (publishDate && applicationDeadline && applicationDeadline.getTime() < publishDate.getTime()) {
    return ApiResponse.error(res, 'Application deadline cannot be earlier than the drive post date.', 422);
  }
  if (applicationDeadline && applicationDeadline.getTime() <= Date.now()) {
    return ApiResponse.error(res, 'Application deadline must be a future date.', 422);
  }

  Object.assign(job, req.body);
  if (job.isPublished || job.approvalStatus === 'approved') {
    job.approvalStatus = 'pending';
    job.status = 'pending';
    job.isPublished = false;
    job.publishedBy = null;
  }
  await job.save();
  return ApiResponse.success(res, job, 'Drive updated');
}));

router.patch('/:id/status', protect, authorize('recruiter'), validate(z.object({
  status: z.enum(['draft', 'pending', 'active', 'inactive', 'closed', 'cancelled']),
})), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return ApiResponse.error(res, 'Invalid drive ID.', 400);
  const recruiter = await Recruiter.findOne({ userId: req.user._id });
  if (!recruiter?.companyId) return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
  const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!job) return ApiResponse.error(res, 'Drive not found or you do not own it.', 404);
  if ((job.status === 'closed' || job.status === 'cancelled') && req.body.status !== job.status) {
    return ApiResponse.error(res, 'Closed or cancelled drives cannot change status.', 409);
  }

  if (req.body.status === 'active' && (!job.isPublished || job.approvalStatus !== 'approved')) {
    return ApiResponse.error(res, 'Only Placement Officer-approved drives can be activated.', 409);
  }
  if (req.body.status === 'closed' || req.body.status === 'cancelled') {
    job.closedAt = new Date();
  }
  if (req.body.status === 'inactive' || req.body.status === 'closed' || req.body.status === 'cancelled') {
    job.isPublished = false;
  }
  if (req.body.status === 'active') job.isPublished = true;
  job.status = req.body.status;
  await job.save();
  return ApiResponse.success(res, job, 'Drive status updated');
}));

router.delete('/:id', protect, authorize('recruiter'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return ApiResponse.error(res, 'Invalid drive ID.', 400);
  const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!job) return ApiResponse.error(res, 'Drive not found or you do not own it.', 404);

  const applicationCount = await Application.countDocuments({ jobId: job._id, status: { $ne: 'withdrawn' } });
  if (applicationCount > 0) {
    job.status = 'cancelled';
    job.approvalStatus = 'rejected';
    job.isPublished = false;
    job.closedAt = new Date();
    await job.save();
    return ApiResponse.success(res, { id: job._id, cancelled: true, applicationCount }, 'Drive cancelled because applications exist; application history was preserved');
  }
  await Job.deleteOne({ _id: job._id });
  return ApiResponse.success(res, { id: job._id, deleted: true }, 'Drive deleted');
}));

module.exports = router;
