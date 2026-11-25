const mongoose = require('mongoose');
const OfferLetter = require('../models/OfferLetter.model');
const Application = require('../models/Application.model');
const Student = require('../models/Student.model');
const Company = require('../models/Company.model');
const Job = require('../models/Job.model');
const Recruiter = require('../models/Recruiter.model');
const ApiResponse = require('../utils/apiResponse');
const { createUserNotification } = require('../services/notificationService');
const {
  generateOfferLetterPdf,
  removeOfferLetterPdf,
  resolveOfferLetterPdfPath,
} = require('../services/offerLetterService');

const offerPopulation = [
  { path: 'studentId', select: 'fullName rollNumber branch graduationYear userId' },
  { path: 'companyId', select: 'name logo website location hrName' },
  { path: 'jobId', select: 'title location jobType' },
  { path: 'applicationId', select: 'status appliedAt' },
  { path: 'recruiterId', select: 'fullName designation' },
];

const getRecruiterForRequest = async (user) => {
  const recruiter = await Recruiter.findOne({ userId: user._id });
  if (!recruiter?.companyId || recruiter.approvalStatus !== 'approved') return null;
  return recruiter;
};

const offerAccess = async (offer, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'student') {
    const student = await Student.findOne({ userId: user._id }).select('_id');
    return Boolean(
      student
      && String(offer.studentId) === String(student._id)
      && offer.status !== 'generated'
      && offer.status !== 'revoked',
    );
  }
  if (user.role === 'recruiter') {
    const recruiter = await getRecruiterForRequest(user);
    if (!recruiter || String(recruiter.companyId) !== String(offer.companyId)) return false;
    return Boolean(await Job.findOne({
      _id: offer.jobId,
      companyId: recruiter.companyId,
      createdBy: user._id,
    }).select('_id'));
  }
  return false;
};

const getOffers = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
  let filter = {};
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id }).select('_id');
    if (!student) return ApiResponse.error(res, 'Student profile not found.', 404);
    filter = { studentId: student._id, status: { $nin: ['generated', 'revoked'] } };
  } else if (req.user.role === 'recruiter') {
    const recruiter = await getRecruiterForRequest(req.user);
    if (!recruiter) return ApiResponse.error(res, 'Recruiter account is not approved.', 403);
    const jobs = await Job.find({ companyId: recruiter.companyId, createdBy: req.user._id }).select('_id');
    filter = { companyId: recruiter.companyId, jobId: { $in: jobs.map(({ _id }) => _id) } };
  }
  if (req.query.status) filter.status = req.query.status;
  const [offers, total, statusCounts] = await Promise.all([
    OfferLetter.find(filter).populate(offerPopulation).sort({ createdAt: -1 })
      .skip((page - 1) * pageSize).limit(pageSize),
    OfferLetter.countDocuments(filter),
    OfferLetter.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const records = offers.map((offer) => {
    const record = offer.toObject();
    if (record.privatePdf) {
      record.privatePdf = {
        originalFileName: record.privatePdf.originalFileName,
        fileSize: record.privatePdf.fileSize,
      };
    }
    record.pdfUrl = `/api/v1/offers/${offer._id}/pdf`;
    return record;
  });
  return ApiResponse.success(res, {
    records,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    summary: statusCounts.reduce((summary, item) => {
      summary[item._id] = item.count;
      return summary;
    }, { total, generated: 0, issued: 0, accepted: 0, rejected: 0, expired: 0, revoked: 0 }),
  });
};

const createOffer = async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.applicationId)) {
    return ApiResponse.error(res, 'Invalid application ID.', 400);
  }
  const application = await Application.findById(req.body.applicationId);
  if (!application) return ApiResponse.error(res, 'Application not found.', 404);
  if (application.status !== 'selected') {
    return ApiResponse.error(res, 'An offer can only be created for a selected application.', 409);
  }
  if (await OfferLetter.findOne({ applicationId: application._id }).select('_id')) {
    return ApiResponse.error(res, 'An offer already exists for this application.', 409);
  }
  const [job, student, company] = await Promise.all([
    Job.findById(application.jobId),
    Student.findById(application.studentId),
    Company.findById(application.companyId),
  ]);
  if (!job || !student || !company || String(job.companyId) !== String(application.companyId)) {
    return ApiResponse.error(res, 'Application company details could not be verified.', 409);
  }

  let recruiter;
  if (req.user.role === 'recruiter') {
    recruiter = await getRecruiterForRequest(req.user);
    if (!recruiter || String(recruiter.companyId) !== String(application.companyId)) {
      return ApiResponse.error(res, 'You cannot create an offer for another company.', 403);
    }
    if (String(job.createdBy) !== String(req.user._id)) {
      return ApiResponse.error(res, 'You cannot create an offer for another recruiter drive.', 403);
    }
  } else {
    recruiter = await Recruiter.findOne({
      companyId: application.companyId,
      approvalStatus: 'approved',
      ...(job.createdByRole === 'recruiter' ? { userId: job.createdBy } : {}),
    });
    if (!recruiter) {
      return ApiResponse.error(res, 'No approved recruiter is associated with this company drive.', 409);
    }
  }

  const offerLetterNumber = `DCRUST-${new Date().getFullYear()}-${require('crypto').randomBytes(6).toString('hex').toUpperCase()}`;
  let generatedFile;
  try {
    const offerData = {
      offerLetterNumber,
      offerDate: new Date(),
      studentName: student.fullName,
      rollNumber: student.rollNumber,
      companyName: company.name,
      companyLogo: company.logo,
      companyLocation: company.location,
      companyContact: company.hrEmail,
      designation: req.body.designation || job.title,
      annualCtc: req.body.annualCtc,
      monthlyStipend: req.body.monthlyStipend || 0,
      employmentType: req.body.employmentType || job.jobType,
      jobLocation: req.body.jobLocation || job.location,
      joiningDate: req.body.joiningDate || null,
      reportingDetails: req.body.reportingDetails || '',
      termsAndConditions: req.body.termsAndConditions || '',
      authorizedSignatory: req.body.authorizedSignatory || company.hrName || '',
    };
    generatedFile = await generateOfferLetterPdf(offerData);
    const offer = await OfferLetter.create({
      studentId: student._id,
      applicationId: application._id,
      jobId: job._id,
      companyId: company._id,
      recruiterId: recruiter._id,
      createdBy: req.user._id,
      offerLetterNumber,
      designation: offerData.designation,
      annualCtc: offerData.annualCtc,
      monthlyStipend: offerData.monthlyStipend,
      jobLocation: offerData.jobLocation,
      reportingDetails: offerData.reportingDetails,
      termsAndConditions: offerData.termsAndConditions,
      authorizedSignatory: offerData.authorizedSignatory,
      offerDate: offerData.offerDate,
      joiningDate: offerData.joiningDate,
      employmentType: offerData.employmentType,
      privatePdf: {
        storedFileName: generatedFile.storedFileName,
        originalFileName: generatedFile.originalFileName,
        fileSize: generatedFile.fileSize,
      },
      status: 'generated',
      statusHistory: [{
        status: 'generated',
        changedBy: req.user._id,
        changedByRole: req.user.role,
        remarks: 'Offer PDF generated',
      }],
    });
    return ApiResponse.success(res, offer, 'Offer letter generated. Issue it to notify the student.', 201);
  } catch (error) {
    if (generatedFile) removeOfferLetterPdf(generatedFile.storedFileName);
    if (error.code === 11000) {
      return ApiResponse.error(res, 'An offer already exists for this application.', 409);
    }
    throw error;
  }
};

const updateOfferStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid offer ID.', 400);
  }
  const offer = await OfferLetter.findById(req.params.id);
  if (!offer) return ApiResponse.error(res, 'Offer letter not found.', 404);

  const { status, remarks = '' } = req.body;
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id }).select('_id');
    if (!student || String(offer.studentId) !== String(student._id)) {
      return ApiResponse.error(res, 'You cannot update another student offer.', 403);
    }
    if (!['accepted', 'rejected'].includes(status) || offer.status !== 'issued') {
      return ApiResponse.error(res, 'Only issued offers can be accepted or rejected.', 409);
    }
  } else if (req.user.role === 'recruiter') {
    const recruiter = await getRecruiterForRequest(req.user);
    if (!recruiter || String(recruiter.companyId) !== String(offer.companyId)) {
      return ApiResponse.error(res, 'You cannot update another company offer.', 403);
    }
    const ownJob = await Job.findOne({
      _id: offer.jobId,
      companyId: recruiter.companyId,
      createdBy: req.user._id,
    }).select('_id');
    if (!ownJob) return ApiResponse.error(res, 'You cannot update an offer for another recruiter drive.', 403);
    if (!['issued', 'revoked'].includes(status)
      || (status === 'issued' && offer.status !== 'generated')
      || (status === 'revoked' && !['generated', 'issued'].includes(offer.status))) {
      return ApiResponse.error(res, 'This offer status transition is not allowed.', 409);
    }
  } else if (req.user.role === 'admin') {
    const transitions = {
      generated: ['issued', 'expired', 'revoked'],
      issued: ['expired', 'revoked'],
      accepted: ['revoked'],
      rejected: ['revoked'],
      expired: ['revoked'],
      revoked: [],
    };
    if (!transitions[offer.status]?.includes(status)) {
      return ApiResponse.error(res, 'This offer status transition is not allowed.', 409);
    }
  } else {
    return ApiResponse.error(res, 'Access denied.', 403);
  }

  const updated = await OfferLetter.findOneAndUpdate(
    { _id: offer._id, status: offer.status },
    {
      $set: { status },
      $push: {
        statusHistory: {
          status,
          changedBy: req.user._id,
          changedByRole: req.user.role,
          remarks,
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) return ApiResponse.error(res, 'Offer status changed concurrently. Refresh and retry.', 409);

  if (status === 'issued') {
    const student = await Student.findById(updated.studentId).select('userId');
    if (student?.userId) {
      await createUserNotification({
        senderId: req.user._id,
        recipientUserId: student.userId,
        subject: 'Offer letter received',
        message: `A new offer from your placement drive is available. Reference: ${updated.offerLetterNumber}.`,
        eventType: 'offer',
      });
    }
  }
  return ApiResponse.success(res, updated, `Offer ${status}`);
};

const downloadOfferPdf = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return ApiResponse.error(res, 'Invalid offer ID.', 400);
  }
  const offer = await OfferLetter.findById(req.params.id);
  if (!offer) return ApiResponse.error(res, 'Offer letter not found.', 404);
  if (!(await offerAccess(offer, req.user))) {
    return ApiResponse.error(res, 'You are not authorized to access this offer letter.', 403);
  }
  const filePath = resolveOfferLetterPdfPath(offer.privatePdf?.storedFileName);
  if (!filePath) return ApiResponse.error(res, 'Offer letter PDF is not available.', 404);
  const safeFileName = String(offer.privatePdf.originalFileName || 'offer-letter.pdf')
    .replace(/[\r\n"\\]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${safeFileName}"`);
  return res.sendFile(filePath);
};

module.exports = { getOffers, createOffer, updateOfferStatus, downloadOfferPdf };
