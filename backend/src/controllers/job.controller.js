const Job = require('../models/Job.model');
const Recruiter = require('../models/Recruiter.model');
const Application = require('../models/Application.model');
const mongoose = require('mongoose');
const Student = require('../models/Student.model');
const ApiResponse = require('../utils/apiResponse');
const { checkEligibility } = require('../services/eligibilityEngine');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getJobs = async (req, res) => {
  let filter = {
    isPublished: true,
    approvalStatus: 'approved',
    status: 'active',
    applicationDeadline: { $gte: new Date() },
    $or: [{ publishDate: null }, { publishDate: { $lte: new Date() } }],
  };
  if (req.query.all === 'true' && req.user?.role === 'admin') {
    filter = {};
  } else if (req.query.all === 'true' && req.user?.role === 'recruiter') {
    filter = { createdBy: req.user._id };
  }
  if (req.query.search) {
    const search = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ title: search }, { description: search }, { requiredSkills: search }] },
    ];
  }
  if (req.query.branch) filter.allowedBranches = String(req.query.branch);
  if (req.query.location) filter.location = new RegExp(escapeRegex(String(req.query.location).trim()), 'i');
  if (req.query.jobType) filter.jobType = String(req.query.jobType);
  if (req.query.minCtc !== undefined && req.query.minCtc !== '') {
    const minCtc = Number(req.query.minCtc);
    if (!Number.isFinite(minCtc) || minCtc < 0) return ApiResponse.error(res, 'Invalid minimum CTC filter.', 400);
    filter['package.max'] = { $gte: minCtc };
  }
  const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const jobsQuery = Job.find(filter)
    .populate('companyId', 'name logo industry location')
    .sort({ createdAt: -1 });
  const [jobs, total] = await Promise.all([
    paginated
      ? jobsQuery.skip((page - 1) * pageSize).limit(pageSize)
      : jobsQuery,
    paginated ? Job.countDocuments(filter) : Promise.resolve(0),
  ]);
  const student = req.user?.role === 'student'
    ? await Student.findOne({ userId: req.user._id })
    : null;
  const data = req.user?.role === 'student'
    ? jobs.map((job) => ({ ...job.toObject(), eligibility: checkEligibility(student, job) }))
    : jobs;
  if (req.user?.role !== 'student') {
    return ApiResponse.success(res, paginated
      ? { records: data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } }
      : data);
  }
  return ApiResponse.success(res, paginated
    ? { records: data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } }
    : data);
};

const getJob = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid drive ID.', 400);
  }
  let job;
  if (req.user?.role === 'admin') {
    job = await Job.findById(req.params.id).populate('companyId');
  } else if (req.user?.role === 'recruiter') {
    job = await Job.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    }).populate('companyId');
  } else {
    job = await Job.findOne({
      _id: req.params.id,
      isPublished: true,
      approvalStatus: 'approved',
      status: 'active',
      applicationDeadline: { $gte: new Date() },
      $or: [{ publishDate: null }, { publishDate: { $lte: new Date() } }],
    }).populate('companyId');
  }
  if (!job) return ApiResponse.error(res, 'Job not found.', 404);
  return ApiResponse.success(res, job);
};

const createJob = async (req, res) => {
  let companyId = req.body.companyId;
  if (req.user.role === 'recruiter') {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter?.companyId) {
      return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
    }
    if (recruiter.approvalStatus !== 'approved') {
      return ApiResponse.error(res, 'Recruiter account is awaiting approval.', 403);
    }
    companyId = recruiter.companyId;
  }
  const job = await Job.create({
    ...req.body,
    companyId,
    createdBy: req.user._id,
    createdByRole: req.user.role,
    approvalStatus: req.user.role === 'admin' ? 'approved' : 'pending',
    status: req.user.role === 'admin' ? 'active' : 'pending',
    isPublished: req.user.role === 'admin',
  });
  return ApiResponse.success(res, job, 'Job created', 201);
};

const updateJob = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid drive ID.', 400);
  }
  const recruiter = await Recruiter.findOne({ userId: req.user._id });
  if (!recruiter?.companyId) {
    return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
  }
  if (recruiter.approvalStatus !== 'approved') {
    return ApiResponse.error(res, 'Recruiter account is awaiting approval.', 403);
  }
  const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!job) {
    return ApiResponse.error(res, 'Drive not found or you do not own it.', 404);
  }
  if (job.status === 'closed' || job.status === 'cancelled') {
    return ApiResponse.error(res, 'Closed or cancelled drives cannot be modified.', 409);
  }

  const publishDate = req.body.publishDate ? new Date(req.body.publishDate) : job.publishDate;
  const applicationDeadline = req.body.applicationDeadline
    ? new Date(req.body.applicationDeadline)
    : job.applicationDeadline;
  if (publishDate && applicationDeadline && applicationDeadline.getTime() < publishDate.getTime()) {
    return ApiResponse.error(
      res,
      'Application deadline cannot be earlier than the drive post date.',
      422,
    );
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
};

const updateJobStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid drive ID.', 400);
  }
  const recruiter = await Recruiter.findOne({ userId: req.user._id });
  if (!recruiter?.companyId) {
    return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
  }
  if (recruiter.approvalStatus !== 'approved') {
    return ApiResponse.error(res, 'Recruiter account is awaiting approval.', 403);
  }
  const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!job) {
    return ApiResponse.error(res, 'Drive not found or you do not own it.', 404);
  }
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
};

const deleteJob = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid drive ID.', 400);
  }
  const recruiter = await Recruiter.findOne({ userId: req.user._id });
  if (!recruiter?.companyId) {
    return ApiResponse.error(res, 'Recruiter is not linked to a company.', 400);
  }
  if (recruiter.approvalStatus !== 'approved') {
    return ApiResponse.error(res, 'Recruiter account is awaiting approval.', 403);
  }
  const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!job) {
    return ApiResponse.error(res, 'Drive not found or you do not own it.', 404);
  }
  const applicationCount = await Application.countDocuments({
    jobId: job._id,
    status: { $ne: 'withdrawn' },
  });
  if (applicationCount > 0) {
    job.status = 'cancelled';
    job.approvalStatus = 'rejected';
    job.isPublished = false;
    job.closedAt = new Date();
    await job.save();
    return ApiResponse.success(
      res,
      { id: job._id, cancelled: true, applicationCount },
      'Drive cancelled because applications exist; application history was preserved',
    );
  }
  await Job.deleteOne({ _id: job._id });
  return ApiResponse.success(res, { id: job._id, deleted: true }, 'Drive deleted');
};

module.exports = {
  getJobs,
  getJob,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJob,
};
