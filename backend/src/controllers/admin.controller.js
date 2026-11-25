const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Company = require('../models/Company.model');
const Job = require('../models/Job.model');
const Application = require('../models/Application.model');
const Placement = require('../models/Placement.model');
const Recruiter = require('../models/Recruiter.model');
const Interview = require('../models/Interview.model');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');
const { sendNotificationEmail } = require('../utils/email');

const getDashboard = async (req, res) => {
  const [
    students,
    recruiters,
    companies,
    jobs,
    applications,
    placedStudents,
    activeDrives,
    placements,
  ] = await Promise.all([
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
  const packages = placements
    .map((placement) => Number(placement.package || 0))
    .filter((value) => value > 0);
  const averagePackage = packages.length
    ? Math.round(packages.reduce((sum, value) => sum + value, 0) / packages.length)
    : 0;
  const highestPackage = packages.length ? Math.max(...packages) : 0;
  const eligibleStudents = await Student.countDocuments({
    placementStatus: { $in: ['unplaced', 'in-progress', 'opted-out'] },
  });
  const placementPercentage = eligibleStudents
    ? Number(((placed / (placed + eligibleStudents)) * 100).toFixed(2))
    : 0;
  return ApiResponse.success(res, {
    students,
    recruiters,
    companies,
    jobs,
    applications,
    placed,
    activeDrives,
    averagePackage,
    highestPackage,
    placementPercentage,
  });
};

const getAnalytics = async (req, res) => {
  const [
    totalStudents,
    eligibleStudents,
    totalApplications,
    shortlistedStudents,
    placedStudents,
    activeCompanies,
    activeDrives,
    branchDistribution,
    branchPlacements,
    companyPlacements,
    applicationStatuses,
    placementYears,
    packageStats,
  ] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ placementStatus: { $in: ['unplaced', 'in-progress', 'opted-out'] } }),
    Application.countDocuments({ status: { $ne: 'withdrawn' } }),
    Application.distinct('studentId', { status: 'shortlisted' }),
    Placement.distinct('studentId', { status: 'placed' }),
    Company.countDocuments({ status: 'active' }),
    Job.countDocuments({
      isPublished: true,
      approvalStatus: 'approved',
      status: 'active',
      applicationDeadline: { $gte: new Date() },
    }),
    Student.aggregate([{ $group: { _id: '$branch', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Placement.aggregate([
      { $match: { status: 'placed' } },
      { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $group: { _id: '$student.branch', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Placement.aggregate([
      { $match: { status: 'placed' } },
      { $lookup: { from: 'companies', localField: 'companyId', foreignField: '_id', as: 'company' } },
      { $unwind: '$company' },
      { $group: { _id: '$company.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Application.aggregate([{ $match: {} }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Placement.aggregate([
      { $match: { status: 'placed', confirmedAt: { $type: 'date' } } },
      { $group: { _id: { $year: '$confirmedAt' }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]),
    Placement.aggregate([
      { $match: { status: 'placed', package: { $type: 'number', $gte: 0 } } },
      { $group: {
        _id: null,
        minimum: { $min: '$package' },
        maximum: { $max: '$package' },
        average: { $avg: '$package' },
      } },
    ]),
  ]);

  const placedCount = placedStudents.length;
  const packageResult = packageStats[0];
  return ApiResponse.success(res, {
    summary: {
      totalStudents,
      eligibleStudents,
      totalApplications,
      shortlistedStudents: shortlistedStudents.length,
      placedStudents: placedCount,
      activeCompanies,
      activeDrives,
      placementPercentage: totalStudents
        ? Number(((placedCount / totalStudents) * 100).toFixed(2))
        : 0,
    },
    branchDistribution: branchDistribution.map((item) => ({ branch: item._id || 'Unknown', count: item.count })),
    branchPlacements: branchPlacements.map((item) => ({ branch: item._id || 'Unknown', count: item.count })),
    companyPlacements: companyPlacements.map((item) => ({ company: item._id || 'Unknown', count: item.count })),
    applicationStatuses: applicationStatuses.map((item) => ({ status: item._id || 'unknown', count: item.count })),
    placementTrends: placementYears.map((item) => ({ year: item._id, count: item.count })),
    packageStatistics: packageResult
      ? {
          minimum: packageResult.minimum,
          maximum: packageResult.maximum,
          average: Number(packageResult.average.toFixed(2)),
        }
      : null,
  });
};

const getStudents = async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const search = new RegExp(escaped, 'i');
    filter.$or = [{ fullName: search }, { rollNumber: search }, { phone: search }];
  }
  if (req.query.branch) filter.branch = req.query.branch;
  const query = Student.find(filter)
    .populate('userId', 'email role isActive')
    .sort({ createdAt: -1 });
  if (req.query.page || req.query.pageSize) {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const [records, total] = await Promise.all([
      query.skip((page - 1) * pageSize).limit(pageSize),
      Student.countDocuments(filter),
    ]);
    return ApiResponse.success(res, {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
  return ApiResponse.success(res, await query);
};

const getCompanies = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = new RegExp(escaped, 'i');
  }
  const query = Company.find(filter).populate('addedBy', 'email').sort({ createdAt: -1 });
  if (req.query.page || req.query.pageSize) {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const [records, total] = await Promise.all([
      query.skip((page - 1) * pageSize).limit(pageSize),
      Company.countDocuments(filter),
    ]);
    return ApiResponse.success(res, {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
  return ApiResponse.success(res, await query);
};

const getCompanyDetails = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid company ID.', 400);
  }
  const company = await Company.findById(req.params.id).populate('addedBy', 'email role');
  if (!company) return ApiResponse.error(res, 'Company not found.', 404);
  const recruiters = await Recruiter.find({ companyId: company._id })
    .populate('userId', 'email isActive')
    .sort({ createdAt: -1 });
  return ApiResponse.success(res, { company, recruiters });
};

const updateCompanyStatus = async (req, res) => {
  if (!['active', 'inactive', 'pending'].includes(req.body.status)) {
    return ApiResponse.error(res, 'Invalid company status.', 400);
  }
  const company = await Company.findById(req.params.id);
  if (!company) return ApiResponse.error(res, 'Company not found.', 404);
  const previousStatus = company.status;
  if (previousStatus === req.body.status) {
    return ApiResponse.success(res, company, 'Company status updated');
  }
  const allowedTransitions = {
    pending: ['active', 'inactive'],
    active: ['inactive'],
    inactive: ['active', 'pending'],
  };
  if (!allowedTransitions[previousStatus]?.includes(req.body.status)) {
    return ApiResponse.error(res, 'Invalid company status transition.', 409);
  }
  company.status = req.body.status;
  company.approvalHistory.push({
    previousStatus,
    newStatus: req.body.status,
    action: req.body.status === 'active'
      ? 'approved'
      : req.body.status === 'pending'
        ? 'pending'
        : 'rejected',
    changedBy: req.user._id,
    changedByRole: req.user.role,
    remarks: req.body.remarks || '',
  });
  await company.save();
  return ApiResponse.success(res, company, 'Company status updated');
};

const getJobs = async (req, res) => {
  const filter = {};
  if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const search = new RegExp(escaped, 'i');
    const companies = await Company.find({ name: search }).select('_id');
    filter.$or = [{ title: search }, { companyId: { $in: companies.map((company) => company._id) } }];
  }
  const query = Job.find(filter).populate('companyId', 'name industry location').sort({ createdAt: -1 });
  if (req.query.page || req.query.pageSize) {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const [records, total] = await Promise.all([
      query.skip((page - 1) * pageSize).limit(pageSize),
      Job.countDocuments(filter),
    ]);
    return ApiResponse.success(res, {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
  return ApiResponse.success(res, await query);
};

const getJobDetails = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid drive ID.', 400);
  }
  const job = await Job.findById(req.params.id)
    .populate('companyId', 'name industry location website hrName hrEmail contactNumber')
    .populate('createdBy', 'email role');
  if (!job) return ApiResponse.error(res, 'Drive not found.', 404);
  return ApiResponse.success(res, job);
};

const getApplications = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const query = Application.find(filter)
      .populate({ path: 'studentId', select: 'fullName rollNumber branch phone' })
      .populate('jobId companyId')
      .sort({ createdAt: -1 });
  if (req.query.page || req.query.pageSize) {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const [records, total] = await Promise.all([
      query.skip((page - 1) * pageSize).limit(pageSize),
      Application.countDocuments(filter),
    ]);
    return ApiResponse.success(res, {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
  return ApiResponse.success(res, await query);
};

const getPlacedStudents = async (req, res) => {
  const filter = { status: 'placed' };
  if (req.query.companyId && mongoose.isValidObjectId(req.query.companyId)) {
    filter.companyId = req.query.companyId;
  }
  if (req.query.placementYear) {
    const year = Number(req.query.placementYear);
    if (!Number.isInteger(year)) {
      return ApiResponse.error(res, 'Invalid placement year.', 400);
    }
    filter.confirmedAt = {
      $gte: new Date(`${year}-01-01T00:00:00.000Z`),
      $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
  }
  let placements = await Placement.find(filter)
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'email' },
    })
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
      return `${student?.fullName || ''} ${student?.rollNumber || ''}`
        .toLowerCase()
        .includes(search);
    });
  }
  if (req.query.branch) {
    placements = placements.filter(
      (placement) => placement.studentId?.branch === req.query.branch,
    );
  }
  if (req.query.passingBatch) {
    placements = placements.filter(
      (placement) =>
        Number(placement.studentId?.graduationYear) === Number(req.query.passingBatch),
    );
  }
  if (req.query.sort === 'package-desc') {
    placements.sort((a, b) => Number(b.package) - Number(a.package));
  }
  if (req.query.sort === 'package-asc') {
    placements.sort((a, b) => Number(a.package) - Number(b.package));
  }
  if (req.query.sort === 'date-asc') {
    placements.sort((a, b) => new Date(a.confirmedAt) - new Date(b.confirmedAt));
  }
  if (!req.query.sort || req.query.sort === 'date-desc') {
    placements.sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt));
  }
  const normalizedPlacements = placements.map((placement) => {
    const record = placement.toObject();
    record.jobRole = String(placement.jobRole || '').trim()
      || String(placement.jobId?.title || '').trim()
      || String(placement.applicationId?.jobId?.title || '').trim()
      || 'Not Available';
    return record;
  });
  return ApiResponse.success(res, normalizedPlacements);
};

const updateJobApproval = async (req, res) => {
  if (req.user.role !== 'admin') {
    return ApiResponse.error(res, 'Only Placement Officer/admin can approve jobs.', 403);
  }
  const job = await Job.findById(req.params.id);
  if (!job) return ApiResponse.error(res, 'Job not found.', 404);
  const previousApprovalStatus = job.approvalStatus;
  if (previousApprovalStatus !== req.body.approvalStatus) {
    job.approvalHistory.push({
      previousApprovalStatus,
      newApprovalStatus: req.body.approvalStatus,
      action: req.body.approvalStatus === 'approved'
        ? 'approved'
        : req.body.approvalStatus === 'rejected'
          ? 'rejected'
          : req.body.approvalStatus === 'pending'
            ? 'pending'
            : 'other',
      changedBy: req.user._id,
      changedByRole: 'admin',
      remarks: req.body.remarks || '',
    });
  }
  job.approvalStatus = req.body.approvalStatus;
  job.status = req.body.approvalStatus === 'approved' ? 'active' : 'closed';
  job.isPublished = req.body.approvalStatus === 'approved';
  job.publishedBy = req.user._id;
  job.publishedAt = new Date();
  await job.save();
  return ApiResponse.success(res, job, 'Job approval updated');
};

const updateStudentPlacementStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid student ID.', 400);
  }
  const student = await Student.findById(req.params.id);
  if (!student) return ApiResponse.error(res, 'Student not found.', 404);

  if (req.body.companyId) {
    if (!mongoose.isValidObjectId(req.body.companyId)) {
      return ApiResponse.error(res, 'Invalid company ID.', 400);
    }
    const company = await Company.findById(req.body.companyId);
    if (!company) return ApiResponse.error(res, 'Company not found.', 404);
  }
  if (req.body.placementStatus === 'placed' && !req.body.companyId) {
    return ApiResponse.error(
      res,
      'Company is required when marking a student as placed.',
      400,
    );
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
      if (!mongoose.isValidObjectId(req.body.applicationId)) {
        return ApiResponse.error(res, 'Invalid application ID.', 400);
      }
      application = await Application.findById(req.body.applicationId);
      if (!application || String(application.studentId) !== String(student._id)) {
        return ApiResponse.error(
          res,
          'Application does not belong to this student.',
          400,
        );
      }
      application.status = 'placed';
      application.statusHistory.push({
        status: 'placed',
        changedBy: req.user._id,
        changedByRole: 'admin',
        reason: req.body.reason || 'Officially placed',
      });
      await application.save();
    }
    let resolvedJobRole = String(req.body.jobRole || '').trim();
    const resolvedJobId = application?.jobId
      || (req.body.jobId && mongoose.isValidObjectId(req.body.jobId)
        ? req.body.jobId
        : null);
    if (!resolvedJobRole && resolvedJobId) {
      const job = await Job.findById(resolvedJobId).select('title');
      resolvedJobRole = String(job?.title || '').trim();
    }
    const placementFilter = application
      ? { applicationId: application._id }
      : {
          studentId: student._id,
          companyId: req.body.companyId,
          status: 'placed',
        };
    await Placement.findOneAndUpdate(
      placementFilter,
      {
        studentId: student._id,
        applicationId: application?._id || null,
        jobId: resolvedJobId,
        companyId: req.body.companyId,
        package: req.body.package || 0,
        monthlyStipend: req.body.monthlyStipend || 0,
        jobLocation: req.body.jobLocation
          || application?.jobId?.location
          || '',
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
      {
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: req.user._id,
        revocationReason:
          req.body.reason
          || `Placement status changed to ${req.body.placementStatus}`,
      },
    );
  }

  if (req.body.placementStatus === 'placed' && student.userId) {
    const user = await User.findById(student.userId).select('email');
    if (user?.email) {
      await sendNotificationEmail(
        user.email,
        'Congratulations - Placement Confirmed',
        `<h2>DCRUST Placement Portal</h2><p>Congratulations ${student.fullName}. Your placement status has been officially confirmed.</p>`,
      );
    }
  }
  return ApiResponse.success(res, student, 'Placement status updated');
};

module.exports = {
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
};
