const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Company = require('../models/Company.model');
const Job = require('../models/Job.model');
const Application = require('../models/Application.model');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const mongoose = require('mongoose');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const Placement = require('../models/Placement.model');
const { sendNotificationEmail } = require('../utils/email');

router.use(protect, authorize('admin'));
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [students, recruiters, companies, jobs, applications, placedStudents, activeDrives, placements] = await Promise.all([
    Student.countDocuments(),
    User.countDocuments({ role: 'recruiter' }),
    Company.countDocuments(),
    Job.countDocuments(),
    Application.countDocuments({ status: { $ne: 'withdrawn' } }),
    Placement.distinct('studentId', { status: 'placed' }),
    Job.countDocuments({
      isPublished: true,
      approvalStatus: 'approved',
      status: 'active',
      applicationDeadline: { $gte: new Date() },
      $or: [{ publishDate: null }, { publishDate: { $lte: new Date() } }],
    }),
    Placement.find({ status: 'placed' }).select('package'),
  ]);
  const placed = placedStudents.length;
  const packages = placements.map((placement) => Number(placement.package || 0)).filter((value) => value > 0);
  const averagePackage = packages.length ? Math.round(packages.reduce((sum, value) => sum + value, 0) / packages.length) : 0;
  const highestPackage = packages.length ? Math.max(...packages) : 0;
  const eligibleStudents = await Student.countDocuments({ placementStatus: { $in: ['unplaced', 'in-progress', 'opted-out'] } });
  const placementPercentage = eligibleStudents ? Number(((placed / (placed + eligibleStudents)) * 100).toFixed(2)) : 0;
  return ApiResponse.success(res, {
    students, recruiters, companies, jobs, applications, placed,
    activeDrives, averagePackage, highestPackage, placementPercentage,
  });
}));
router.get('/students', asyncHandler(async (req, res) => ApiResponse.success(res, await Student.find().populate('userId', 'email role isActive').sort({ createdAt: -1 }))));
router.get('/companies', asyncHandler(async (req, res) => ApiResponse.success(res, await Company.find().populate('addedBy', 'email').sort({ createdAt: -1 }))));
router.patch('/companies/:id/status', asyncHandler(async (req, res) => {
  if (!['active', 'inactive', 'pending'].includes(req.body.status)) return ApiResponse.error(res, 'Invalid company status.', 400);
  return ApiResponse.success(res, await Company.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }), 'Company status updated');
}));
router.get('/jobs', asyncHandler(async (req, res) => ApiResponse.success(res, await Job.find().populate('companyId', 'name').sort({ createdAt: -1 }))));
router.get('/applications', asyncHandler(async (req, res) => ApiResponse.success(res, await Application.find()
  .populate({ path: 'studentId', select: 'fullName rollNumber branch phone' })
  .populate('jobId companyId')
  .sort({ createdAt: -1 }))));
router.get('/placed-students', asyncHandler(async (req, res) => {
  const filter = { status: 'placed' };
  if (req.query.companyId && mongoose.isValidObjectId(req.query.companyId)) filter.companyId = req.query.companyId;
  if (req.query.placementYear) {
    const year = Number(req.query.placementYear);
    if (!Number.isInteger(year)) return ApiResponse.error(res, 'Invalid placement year.', 400);
    filter.confirmedAt = { $gte: new Date(`${year}-01-01T00:00:00.000Z`), $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`) };
  }
  let placements = await Placement.find(filter)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'email' } })
    .populate('companyId', 'name')
    .populate({
      path: 'applicationId',
      select: 'status jobId',
      populate: { path: 'jobId', select: 'title' },
    })
    .populate('jobId', 'title location package');

  if (req.query.search) {
    const search = String(req.query.search).trim().toLowerCase();
    placements = placements.filter((placement) => {
      const student = placement.studentId;
      return `${student?.fullName || ''} ${student?.rollNumber || ''}`.toLowerCase().includes(search);
    });
  }
  if (req.query.branch) placements = placements.filter((placement) => placement.studentId?.branch === req.query.branch);
  if (req.query.passingBatch) placements = placements.filter((placement) => Number(placement.studentId?.graduationYear) === Number(req.query.passingBatch));
  if (req.query.sort === 'package-desc') placements.sort((a, b) => Number(b.package) - Number(a.package));
  if (req.query.sort === 'package-asc') placements.sort((a, b) => Number(a.package) - Number(b.package));
  if (req.query.sort === 'date-asc') placements.sort((a, b) => new Date(a.confirmedAt) - new Date(b.confirmedAt));
  if (!req.query.sort || req.query.sort === 'date-desc') placements.sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt));
  const normalizedPlacements = placements.map((placement) => {
    const record = placement.toObject();
    record.jobRole = String(placement.jobRole || '').trim()
      || String(placement.jobId?.title || '').trim()
      || String(placement.applicationId?.jobId?.title || '').trim()
      || 'Not Available';
    return record;
  });
  return ApiResponse.success(res, normalizedPlacements);
}));
router.patch('/jobs/:id/approval', asyncHandler(async (req, res) => ApiResponse.success(res, await Job.findByIdAndUpdate(req.params.id, { approvalStatus: req.body.approvalStatus, status: req.body.approvalStatus === 'approved' ? 'active' : 'closed', isPublished: req.body.approvalStatus === 'approved', publishedBy: req.user._id, publishedAt: new Date() }, { new: true }), 'Job approval updated')));

router.patch('/students/:id/placement-status', validate(z.object({
  placementStatus: z.enum(['unplaced', 'placed', 'opted-out', 'higher-studies', 'internship', 'not-interested', 'in-progress']),
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
})), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return ApiResponse.error(res, 'Invalid student ID.', 400);
  const student = await Student.findById(req.params.id);
  if (!student) return ApiResponse.error(res, 'Student not found.', 404);

  if (req.body.companyId) {
    if (!mongoose.isValidObjectId(req.body.companyId)) return ApiResponse.error(res, 'Invalid company ID.', 400);
    const company = await Company.findById(req.body.companyId);
    if (!company) return ApiResponse.error(res, 'Company not found.', 404);
  }
  if (req.body.placementStatus === 'placed' && !req.body.companyId) {
    return ApiResponse.error(res, 'Company is required when marking a student as placed.', 400);
  }

  const previousStatus = student.placementStatus;
  student.placementStatus = req.body.placementStatus;
  student.placementStatusHistory.push({
    previousStatus,
    newStatus: req.body.placementStatus,
    updatedBy: req.user._id,
    updatedAt: new Date(),
    reason: req.body.reason || '',
    companyId: req.body.companyId || null,
    placementDetails: req.body.placementDetails || '',
    package: req.body.package || 0,
  });
  await student.save();

  if (req.body.placementStatus === 'placed') {
    let application = null;
    if (req.body.applicationId) {
      if (!mongoose.isValidObjectId(req.body.applicationId)) return ApiResponse.error(res, 'Invalid application ID.', 400);
      application = await Application.findById(req.body.applicationId);
      if (!application || String(application.studentId) !== String(student._id)) {
        return ApiResponse.error(res, 'Application does not belong to this student.', 400);
      }
      application.status = 'placed';
      application.statusHistory.push({ status: 'placed', changedBy: req.user._id, changedByRole: 'admin', reason: req.body.reason || 'Officially placed' });
      await application.save();
    }
    let resolvedJobRole = String(req.body.jobRole || '').trim();
    const resolvedJobId = application?.jobId || (req.body.jobId && mongoose.isValidObjectId(req.body.jobId) ? req.body.jobId : null);
    if (!resolvedJobRole && resolvedJobId) {
      const job = await Job.findById(resolvedJobId).select('title');
      resolvedJobRole = String(job?.title || '').trim();
    }
    const placementFilter = application ? { applicationId: application._id } : { studentId: student._id, companyId: req.body.companyId, status: 'placed' };
    await Placement.findOneAndUpdate(
      placementFilter,
      {
        studentId: student._id,
        applicationId: application?._id || null,
        jobId: resolvedJobId,
        companyId: req.body.companyId,
        package: req.body.package || 0,
        monthlyStipend: req.body.monthlyStipend || 0,
        jobLocation: req.body.jobLocation || application?.jobId?.location || '',
        jobRole: resolvedJobRole,
        offerDate: req.body.offerDate || null,
        joiningDate: req.body.joiningDate || null,
        confirmedAt: new Date(),
        confirmedBy: req.user._id,
        status: 'placed',
        placementDetails: req.body.placementDetails || '',
        revokedAt: null,
        revokedBy: null,
        revocationReason: '',
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } else if (previousStatus === 'placed') {
    await Placement.updateMany(
      { studentId: student._id, status: 'placed' },
      { status: 'revoked', revokedAt: new Date(), revokedBy: req.user._id, revocationReason: req.body.reason || `Placement status changed to ${req.body.placementStatus}` },
    );
  }

  if (req.body.placementStatus === 'placed' && student.userId) {
    const user = await User.findById(student.userId).select('email');
    if (user?.email) {
      await sendNotificationEmail(user.email, 'Congratulations - Placement Confirmed', `<h2>Smart Campus Placement</h2><p>Congratulations ${student.fullName}. Your placement status has been officially confirmed.</p>`);
    }
  }
  return ApiResponse.success(res, student, 'Placement status updated');
}));

module.exports = router;
