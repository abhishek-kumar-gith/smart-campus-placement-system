const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const Placement = require('../models/Placement.model');
const Company = require('../models/Company.model');
const Job = require('../models/Job.model');
const User = require('../models/User.model');
const Recruiter = require('../models/Recruiter.model');
const { createUserNotification } = require('../services/notificationService');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPublicPlacementSummary = async (req, res) => {
  const [students, departments, recruiters, placedStudents] = await Promise.all([
    Student.countDocuments(),
    Student.distinct('branch'),
    User.countDocuments({ role: 'recruiter', isActive: true }),
    Placement.distinct('studentId', { status: 'placed' }),
  ]);
  const placementPercentage = students
    ? Number(((placedStudents.length / students) * 100).toFixed(2))
    : 0;
  return ApiResponse.success(res, {
    students,
    departments: departments.filter(Boolean).length,
    recruiters,
    placed: placedStudents.length,
    placementPercentage,
  });
};

const getPublicPlacements = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(req.query.pageSize, 10) || 12, 1),
    48,
  );
  const match = { status: 'placed' };
  if (req.query.branch) match['student.branch'] = String(req.query.branch);
  if (req.query.company) {
    match['company.name'] = new RegExp(escapeRegex(req.query.company), 'i');
  }
  if (req.query.placementYear) {
    const year = Number(req.query.placementYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      return ApiResponse.error(res, 'Invalid placement year.', 400);
    }
    match.confirmedAt = {
      $gte: new Date(`${year}-01-01T00:00:00.000Z`),
      $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
  }
  if (req.query.search) {
    const search = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
    match.$or = [
      { 'student.fullName': search },
      { 'student.rollNumber': search },
    ];
  }

  const joins = [
    { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $lookup: { from: 'companies', localField: 'companyId', foreignField: '_id', as: 'company' } },
    { $unwind: '$company' },
  ];
  const [result, metadata] = await Promise.all([
    Placement.aggregate([
      ...joins,
      { $match: match },
      { $sort: { confirmedAt: -1 } },
      {
        $facet: {
          records: [
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                _id: 1,
                studentName: '$student.fullName',
                rollNumber: '$student.rollNumber',
                branch: '$student.branch',
                department: '$student.degree',
                studentPhoto: '$student.profilePhotoUrl',
                companyName: '$company.name',
                placementYear: { $year: '$confirmedAt' },
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]),
    Placement.aggregate([
      ...joins,
      { $match: { status: 'placed' } },
      {
        $group: {
          _id: null,
          branches: { $addToSet: '$student.branch' },
          companies: { $addToSet: '$company.name' },
          years: { $addToSet: { $year: '$confirmedAt' } },
        },
      },
      { $project: { _id: 0, branches: 1, companies: 1, years: 1 } },
    ]),
  ]);
  const payload = result[0] || { records: [], total: [] };
  const total = payload.total[0]?.count || 0;
  const filters = metadata[0] || { branches: [], companies: [], years: [] };
  return ApiResponse.success(res, {
    records: payload.records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    filters: {
      branches: filters.branches.filter(Boolean).sort(),
      companies: filters.companies.filter(Boolean).sort(),
      years: filters.years.filter(Boolean).sort((a, b) => b - a),
    },
  });
};

const getPlacements = async (req, res) => {
  let filter = { status: 'placed' };
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    filter.studentId = student?._id;
  } else if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    filter.companyId = recruiter?.companyId || null;
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
  const applications = await Application.find({
    status: 'placed',
    ...(filter.studentId ? { studentId: filter.studentId } : {}),
    ...(filter.companyId ? { companyId: filter.companyId } : {}),
  })
    .populate('studentId jobId companyId')
    .sort({ updatedAt: -1 });
  const normalizedApplications = applications.map((application) => {
    const record = application.toObject();
    record.jobRole = String(application.jobId?.title || '').trim() || 'Not Available';
    return record;
  });
  return ApiResponse.success(res, normalizedApplications);
};

const finalizePlacement = async (req, res) => {
  const { applicationId } = req.body;
  if (!mongoose.isValidObjectId(applicationId)) {
    return ApiResponse.error(res, 'Invalid application ID.', 400);
  }
  const application = await Application.findById(applicationId);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  application.status = 'placed';
  application.statusHistory.push({
    status: 'placed',
    changedBy: req.user._id,
    changedByRole: 'admin',
    reason: 'Placement finalized',
  });
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
  const student = await Student.findById(application.studentId).select('userId');
  if (student?.userId) {
    await createUserNotification({
      senderId: req.user._id,
      recipientUserId: student.userId,
      subject: 'Placement finalized',
      message: 'Your placement has been finalized by the Placement Cell.',
      eventType: 'placement',
    });
  }
  return ApiResponse.success(res, application, 'Placement finalized');
};

module.exports = {
  getPublicPlacementSummary,
  getPublicPlacements,
  getPlacements,
  finalizePlacement,
};
