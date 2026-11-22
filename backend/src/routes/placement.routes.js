const router = require('express').Router();
const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const Placement = require('../models/Placement.model');
const Company = require('../models/Company.model');
const Job = require('../models/Job.model');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const mongoose = require('mongoose');
router.get('/', protect, asyncHandler(async (req, res) => {
  let filter = { status: 'placed' };
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    filter.studentId = student?._id;
  }
  const placements = await Placement.find(filter)
    .populate('studentId')
    .populate({ path: 'applicationId', populate: { path: 'jobId', select: 'title' } })
    .populate({ path: 'jobId', populate: { path: 'companyId', select: 'name location' } })
    .populate('companyId', 'name location')
    .sort({ confirmedAt: -1 });
  if (placements.length) {
    const normalizedPlacements = placements.map((placement) => {
      const record = placement.toObject();
      record.jobRole = String(placement.jobRole || '').trim()
        || String(placement.jobId?.title || '').trim()
        || String(placement.applicationId?.jobId?.title || '').trim()
        || 'Not Available';
      return record;
    });
    return ApiResponse.success(res, normalizedPlacements);
  }
  const applications = await Application.find({ status: 'placed', ...(filter.studentId ? { studentId: filter.studentId } : {}) }).populate('studentId jobId companyId').sort({ updatedAt: -1 });
  const normalizedApplications = applications.map((application) => {
    const record = application.toObject();
    record.jobRole = String(application.jobId?.title || '').trim() || 'Not Available';
    return record;
  });
  return ApiResponse.success(res, normalizedApplications);
}));
router.post('/finalize', protect, authorize('admin'), validate(z.object({
  applicationId: z.string(),
  package: z.coerce.number().min(0).optional(),
  monthlyStipend: z.coerce.number().min(0).optional(),
  jobLocation: z.string().trim().optional(),
  jobRole: z.string().trim().optional(),
  offerDate: z.coerce.date().optional(),
  joiningDate: z.coerce.date().optional(),
  placementDetails: z.string().trim().max(1000).optional(),
})), asyncHandler(async (req, res) => {
  const { applicationId } = req.body;
  if (!mongoose.isValidObjectId(applicationId)) return ApiResponse.error(res, 'Invalid application ID.', 400);
  const application = await Application.findById(applicationId);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  application.status = 'placed';
  application.statusHistory.push({ status: 'placed', changedBy: req.user._id, changedByRole: 'admin', reason: 'Placement finalized' });
  await application.save();
  await Student.findByIdAndUpdate(application.studentId, { placementStatus: 'placed' });
  let resolvedJobRole = String(req.body.jobRole || '').trim();
  if (!resolvedJobRole) {
    const job = await Job.findById(application.jobId).select('title');
    resolvedJobRole = String(job?.title || '').trim();
  }
  await Placement.findOneAndUpdate(
    { applicationId: application._id },
    {
      studentId: application.studentId,
      applicationId: application._id,
      jobId: application.jobId,
      companyId: application.companyId,
      package: req.body.package || 0,
      monthlyStipend: req.body.monthlyStipend || 0,
      jobLocation: req.body.jobLocation || '',
      jobRole: resolvedJobRole,
      offerDate: req.body.offerDate || null,
      joiningDate: req.body.joiningDate || null,
      confirmedAt: new Date(),
      confirmedBy: req.user._id,
      status: 'placed',
      placementDetails: req.body.placementDetails || '',
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return ApiResponse.success(res, application, 'Placement finalized');
}));
module.exports = router;
