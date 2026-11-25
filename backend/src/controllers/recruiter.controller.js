const Recruiter = require('../models/Recruiter.model');
const Application = require('../models/Application.model');
const Company = require('../models/Company.model');
const Interview = require('../models/Interview.model');
const Job = require('../models/Job.model');
const Resume = require('../models/Resume.model');
const Student = require('../models/Student.model');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');
const { checkEligibility } = require('../services/eligibilityEngine');

const getApprovedRecruiter = async (userId) => {
  const recruiter = await Recruiter.findOne({ userId });
  if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved') return null;
  return recruiter;
};

const ownedJobs = (userId, companyId) => ({ createdBy: userId, companyId });

const getProfile = async (req, res) => {
  return ApiResponse.success(
    res,
    await Recruiter.findOne({ userId: req.user._id }).populate('companyId'),
  );
};

const getRecruiters = async (req, res) => {
  return ApiResponse.success(
    res,
    await Recruiter.find().populate('companyId').sort({ createdAt: -1 }),
  );
};

const updateApproval = async (req, res) => {
  return ApiResponse.success(
    res,
    await Recruiter.findByIdAndUpdate(
      req.params.id,
      {
        approvalStatus: req.body.approvalStatus,
        approvedBy: req.user._id,
        approvedAt: new Date(),
      },
      { new: true, runValidators: true },
    ),
    'Recruiter approval updated',
  );
};

const getDashboard = async (req, res) => {
  const recruiter = await getApprovedRecruiter(req.user._id);
  if (!recruiter) return ApiResponse.error(res, 'Recruiter account is not approved or linked to a company.', 403);
  const jobs = await Job.find(ownedJobs(req.user._id, recruiter.companyId)).select('_id title status isPublished approvalStatus');
  const jobIds = jobs.map((job) => job._id);
  const applicationMatch = { jobId: { $in: jobIds }, companyId: recruiter.companyId, status: { $ne: 'withdrawn' } };
  const now = new Date();
  const [
    totalApplications,
    pendingApplications,
    shortlisted,
    rejected,
    selected,
    upcomingInterviews,
    statusDistribution,
    driveApplications,
    interviewProgress,
  ] = await Promise.all([
    Application.countDocuments(applicationMatch),
    Application.countDocuments({ ...applicationMatch, status: 'applied' }),
    Application.countDocuments({ ...applicationMatch, status: 'shortlisted' }),
    Application.countDocuments({ ...applicationMatch, status: 'rejected' }),
    Application.countDocuments({ ...applicationMatch, status: { $in: ['selected', 'placed'] } }),
    Interview.countDocuments({ companyId: recruiter.companyId, jobId: { $in: jobIds }, scheduledAt: { $gte: now }, status: { $in: ['scheduled', 'rescheduled'] } }),
    Application.aggregate([{ $match: applicationMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Application.aggregate([{ $match: applicationMatch }, { $group: { _id: '$jobId', count: { $sum: 1 } } }, { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } }, { $unwind: '$job' }, { $project: { _id: 1, title: '$job.title', count: 1 } }, { $sort: { count: -1 } }]),
    Interview.aggregate([{ $match: { companyId: recruiter.companyId, jobId: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  return ApiResponse.success(res, {
    company: recruiter.companyId,
    activeDrives: jobs.filter((job) => job.status === 'active' && job.isPublished && job.approvalStatus === 'approved').length,
    totalApplications,
    pendingApplications,
    shortlisted,
    rejected,
    selected,
    placed: selected,
    upcomingInterviews,
    statusDistribution,
    driveApplications,
    interviewProgress,
    shortlistingConversion: totalApplications ? Number(((shortlisted / totalApplications) * 100).toFixed(2)) : 0,
    placementConversion: totalApplications ? Number(((selected / totalApplications) * 100).toFixed(2)) : 0,
  });
};

const getRecruiterApplications = async (req, res) => {
  const recruiter = await getApprovedRecruiter(req.user._id);
  if (!recruiter) return ApiResponse.error(res, 'Recruiter account is not approved or linked to a company.', 403);
  const jobs = await Job.find(ownedJobs(req.user._id, recruiter.companyId)).select('_id');
  const jobIds = jobs.map((job) => job._id);
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
  const filter = { jobId: { $in: jobIds }, companyId: recruiter.companyId };
  if (req.query.jobId) {
    if (!mongoose.isValidObjectId(req.query.jobId)) return ApiResponse.error(res, 'Invalid job ID.', 400);
    if (!jobIds.some((id) => String(id) === req.query.jobId)) return ApiResponse.error(res, 'Drive not found.', 404);
    filter.jobId = req.query.jobId;
  }
  if (req.query.status) filter.status = req.query.status;
  const studentFilter = {};
  if (req.query.branch) studentFilter.branch = req.query.branch;
  if (req.query.minCgpa || req.query.maxCgpa) studentFilter.cgpa = { ...(req.query.minCgpa ? { $gte: Number(req.query.minCgpa) } : {}), ...(req.query.maxCgpa ? { $lte: Number(req.query.maxCgpa) } : {}) };
  if (req.query.search) {
    const term = String(req.query.search).trim();
    studentFilter.$or = [{ fullName: { $regex: term, $options: 'i' } }, { rollNumber: { $regex: term, $options: 'i' } }, { skills: { $regex: term, $options: 'i' } }];
  }
  if (Object.keys(studentFilter).length) {
    const students = await Student.find(studentFilter).select('_id');
    filter.studentId = { $in: students.map((student) => student._id) };
  }
  const [records, total] = await Promise.all([
    Application.find(filter).populate({ path: 'studentId', select: 'fullName rollNumber branch cgpa graduationYear skills backlogs profilePhotoUrl' }).populate('jobId', 'title companyId').sort({ appliedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Application.countDocuments(filter),
  ]);
  const snapshotRecords = records.map((application) => {
    const record = application.toObject();
    record.resume = record.submittedResumeSnapshot
      ? { available: true, fileName: record.submittedResumeSnapshot.originalFileName, submittedAt: record.submittedResumeSnapshot.submittedAt, viewUrl: `/api/v1/applications/${record._id}/resume`, downloadUrl: `/api/v1/applications/${record._id}/resume?download=true` }
      : { available: false, message: 'No resume snapshot was submitted with this application.' };
    return record;
  });
  return ApiResponse.paginated(res, snapshotRecords, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
};

const getEligibleStudents = async (req, res) => {
  const recruiter = await getApprovedRecruiter(req.user._id);
  if (!recruiter) return ApiResponse.error(res, 'Recruiter account is not approved or linked to a company.', 403);
  const jobFilter = ownedJobs(req.user._id, recruiter.companyId);
  if (req.query.jobId) {
    if (!mongoose.isValidObjectId(req.query.jobId)) return ApiResponse.error(res, 'Invalid job ID.', 400);
    jobFilter._id = req.query.jobId;
  }
  const jobs = await Job.find(jobFilter).select('title minCgpa allowedBranches targetGraduationYear maxBacklogs targetSemester allowedSemesters requiredSkills');
  if (req.query.jobId && !jobs.length) return ApiResponse.error(res, 'Drive not found.', 404);
  const studentFilter = {};
  if (req.query.branch) studentFilter.branch = req.query.branch;
  if (req.query.minCgpa) studentFilter.cgpa = { $gte: Number(req.query.minCgpa) };
  if (req.query.maxCgpa) studentFilter.cgpa = { ...(studentFilter.cgpa || {}), $lte: Number(req.query.maxCgpa) };
  if (req.query.graduationYear) studentFilter.graduationYear = Number(req.query.graduationYear);
  if (req.query.skills) studentFilter.skills = { $all: String(req.query.skills).split(',').map((skill) => skill.trim().toLowerCase()).filter(Boolean) };
  if (req.query.backlogsEligible === 'true') studentFilter['backlogs.count'] = { $lte: 0 };
  if (req.query.search) studentFilter.fullName = { $regex: String(req.query.search).trim(), $options: 'i' };
  const candidates = await Student.find(studentFilter).select('fullName rollNumber branch cgpa graduationYear skills backlogs profilePhotoUrl').sort({ fullName: 1 });
  const eligible = [];
  for (const student of candidates) {
    const relevantJobs = jobs.filter((job) => checkEligibility(student, job).passed).map((job) => ({ _id: job._id, title: job.title }));
    if (relevantJobs.length) eligible.push({ ...student.toObject(), relevantJobs });
  }
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
  const records = eligible.slice((page - 1) * pageSize, page * pageSize);
  const resumes = await Resume.find({ studentId: { $in: records.map((student) => student._id) } }).select('studentId');
  const resumeIds = new Set(resumes.map((resume) => String(resume.studentId)));
  return ApiResponse.paginated(res, records.map((student) => ({ ...student, resumeAvailable: resumeIds.has(String(student._id)) })), { page, pageSize, total: eligible.length, totalPages: Math.ceil(eligible.length / pageSize) });
};

const getCompanyProfile = async (req, res) => {
  const recruiter = await getApprovedRecruiter(req.user._id);
  if (!recruiter) return ApiResponse.error(res, 'Recruiter account is not approved or linked to a company.', 403);
  return ApiResponse.success(res, await Company.findById(recruiter.companyId));
};

const updateCompanyProfile = async (req, res) => {
  const recruiter = await getApprovedRecruiter(req.user._id);
  if (!recruiter) return ApiResponse.error(res, 'Recruiter account is not approved or linked to a company.', 403);
  const company = await Company.findOneAndUpdate({ _id: recruiter.companyId }, req.body, { new: true, runValidators: true });
  return ApiResponse.success(res, company, 'Company profile updated');
};

module.exports = {
  getProfile, getRecruiters, updateApproval, getDashboard, getRecruiterApplications,
  getEligibleStudents, getCompanyProfile, updateCompanyProfile,
};
