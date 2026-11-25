const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');

const OfferLetter = require('../src/models/OfferLetter.model');
const Application = require('../src/models/Application.model');
const Student = require('../src/models/Student.model');
const Company = require('../src/models/Company.model');
const Job = require('../src/models/Job.model');
const Recruiter = require('../src/models/Recruiter.model');
const offerController = require('../src/controllers/offerLetter.controller');
const offerService = require('../src/services/offerLetterService');

const response = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  setHeader(name, value) { this.headers[name] = value; },
  sendFile(filePath) { this.filePath = filePath; return this; },
});

test('offer PDF service creates a valid private PDF and removes it safely', async () => {
  const offerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dcrust-offer-test-'));
  try {
    const generated = await offerService.generateOfferLetterPdf({
      offerLetterNumber: 'DCRUST-2026-TEST01',
      offerDate: new Date('2026-11-25T00:00:00Z'),
      studentName: 'Test Student',
      rollNumber: 'TEST-001',
      companyName: 'Example Company',
      designation: 'Graduate Engineer',
      annualCtc: 600000,
      monthlyStipend: 0,
      employmentType: 'Full-time',
      jobLocation: 'Sonipat',
      joiningDate: new Date('2027-01-01T00:00:00Z'),
      reportingDetails: '',
      termsAndConditions: '',
      authorizedSignatory: '',
    }, { offerRoot });
    const content = fs.readFileSync(generated.storedFilePath);
    assert.equal(content.subarray(0, 5).toString(), '%PDF-');
    assert.ok(generated.fileSize > 0);
    assert.match(generated.originalFileName, /^Offer-DCRUST-2026-TEST01\.pdf$/);
    assert.equal(offerService.resolveOfferLetterPdfPath(generated.storedFileName, { offerRoot }), generated.storedFilePath);
    assert.equal(offerService.removeOfferLetterPdf(generated.storedFileName, { offerRoot }), true);
    assert.equal(offerService.resolveOfferLetterPdfPath(generated.storedFileName, { offerRoot }), null);
    assert.equal(offerService.resolveOfferLetterPdfPath('..\\secret.pdf', { offerRoot }), null);
  } finally {
    fs.rmSync(offerRoot, { recursive: true, force: true });
  }
});

test('offer routes are protected and expose role-scoped list, PDF, create, and status endpoints', () => {
  const router = require('../src/routes/offerLetter.routes');
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods).join(',')}:${layer.route.path}`);
  assert.ok(routes.includes('get:/'));
  assert.ok(routes.includes('get:/:id/pdf'));
  assert.ok(routes.includes('post:/'));
  assert.ok(routes.includes('patch:/:id/status'));
  const app = require('../src/app');
  const routePaths = app._router.stack
    .filter((layer) => layer.name === 'router')
    .map((layer) => layer.regexp.toString());
  assert.ok(routePaths.some((route) => route.includes('api\\/v1\\/offers')));
});

test('selected application offer generation stores PDF metadata and rejects duplicate records', async () => {
  const originals = {
    application: Application.findById,
    student: Student.findById,
    company: Company.findById,
    job: Job.findById,
    recruiter: Recruiter.findOne,
    findOne: OfferLetter.findOne,
    create: OfferLetter.create,
  };
  const applicationId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  const recruiterId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const application = { _id: applicationId, studentId, companyId, jobId, status: 'selected' };
  let created;
  Application.findById = async () => application;
  Student.findById = async () => ({ _id: studentId, fullName: 'Test Student', rollNumber: 'TEST-001', userId });
  Company.findById = async () => ({ _id: companyId, name: 'Example Company', hrName: 'HR Lead' });
  Job.findById = async () => ({ _id: jobId, companyId, createdBy: userId, createdByRole: 'recruiter', title: 'Engineer', location: 'Sonipat', jobType: 'Full-time' });
  Recruiter.findOne = async () => ({ _id: recruiterId, companyId, approvalStatus: 'approved' });
  OfferLetter.findOne = () => ({ select: async () => null });
  OfferLetter.create = async (offer) => {
    created = offer;
    return { _id: new mongoose.Types.ObjectId(), ...offer };
  };
  try {
    const res = response();
    await offerController.createOffer({
      body: { applicationId: applicationId.toString(), annualCtc: 650000 },
      user: { _id: userId, role: 'recruiter' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(created.status, 'generated');
    assert.equal(created.applicationId, applicationId);
    assert.equal(created.privatePdf.fileSize > 0, true);
    assert.match(created.privatePdf.storedFileName, /^offer-[a-f0-9-]+\.pdf$/i);
    assert.equal(created.statusHistory[0].status, 'generated');
    assert.equal(offerService.resolveOfferLetterPdfPath(created.privatePdf.storedFileName) !== null, true);
    offerService.removeOfferLetterPdf(created.privatePdf.storedFileName);

    OfferLetter.create = async () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    };
    const duplicateResponse = response();
    await offerController.createOffer({
      body: { applicationId: applicationId.toString(), annualCtc: 650000 },
      user: { _id: userId, role: 'recruiter' },
    }, duplicateResponse);
    assert.equal(duplicateResponse.statusCode, 409);
  } finally {
    Application.findById = originals.application;
    Student.findById = originals.student;
    Company.findById = originals.company;
    Job.findById = originals.job;
    Recruiter.findOne = originals.recruiter;
    OfferLetter.findOne = originals.findOne;
    OfferLetter.create = originals.create;
  }
});

test('recruiter cannot generate an offer for a job they do not own', async () => {
  const originalApplicationFindById = Application.findById;
  const originalStudentFindById = Student.findById;
  const originalCompanyFindById = Company.findById;
  const originalJobFindById = Job.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  const originalOfferFindOne = OfferLetter.findOne;
  const applicationId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  Application.findById = async () => ({
    _id: applicationId,
    studentId: new mongoose.Types.ObjectId(),
    companyId,
    jobId,
    status: 'selected',
  });
  Student.findById = async () => ({ _id: new mongoose.Types.ObjectId(), fullName: 'Test Student' });
  Company.findById = async () => ({ _id: companyId, name: 'Example Company' });
  Job.findById = async () => ({ _id: jobId, companyId, createdBy: new mongoose.Types.ObjectId(), createdByRole: 'recruiter', title: 'Engineer', location: 'Sonipat' });
  Recruiter.findOne = async () => ({ companyId, approvalStatus: 'approved' });
  OfferLetter.findOne = () => ({ select: async () => null });
  try {
    const res = response();
    await offerController.createOffer({
      body: { applicationId: applicationId.toString(), annualCtc: 650000 },
      user: { _id: userId, role: 'recruiter' },
    }, res);
    assert.equal(res.statusCode, 403);
  } finally {
    Application.findById = originalApplicationFindById;
    Student.findById = originalStudentFindById;
    Company.findById = originalCompanyFindById;
    Job.findById = originalJobFindById;
    Recruiter.findOne = originalRecruiterFindOne;
    OfferLetter.findOne = originalOfferFindOne;
  }
});

test('only the offer recipient can change an issued offer and status history is appended atomically', async () => {
  const originalFindById = OfferLetter.findById;
  const originalStudentFindOne = Student.findOne;
  const originalFindOneAndUpdate = OfferLetter.findOneAndUpdate;
  const offerId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  let filter;
  let update;
  OfferLetter.findById = async () => ({
    _id: offerId,
    studentId,
    status: 'issued',
  });
  Student.findOne = () => ({ select: async () => ({ _id: studentId }) });
  OfferLetter.findOneAndUpdate = async (receivedFilter, receivedUpdate) => {
    filter = receivedFilter;
    update = receivedUpdate;
    return { _id: offerId, status: 'accepted' };
  };
  try {
    const res = response();
    await offerController.updateOfferStatus({
      params: { id: offerId.toString() },
      body: { status: 'accepted', remarks: 'Accepted through portal' },
      user: { _id: userId, role: 'student' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(filter.status, 'issued');
    assert.equal(update.$set.status, 'accepted');
    assert.equal(update.$push.statusHistory.changedByRole, 'student');

    Student.findOne = () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId() }) });
    const denied = response();
    await offerController.updateOfferStatus({
      params: { id: offerId.toString() },
      body: { status: 'accepted' },
      user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
    }, denied);
    assert.equal(denied.statusCode, 403);
  } finally {
    OfferLetter.findById = originalFindById;
    Student.findOne = originalStudentFindOne;
    OfferLetter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('offer downloads use private paths and deny unrelated recruiters', async () => {
  const originalFindById = OfferLetter.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  const originalJobFindOne = Job.findOne;
  const file = await offerService.generateOfferLetterPdf({
    offerLetterNumber: 'DCRUST-2026-DOWNLOAD',
    offerDate: new Date(),
    studentName: 'Test Student',
    companyName: 'Example Company',
    designation: 'Engineer',
    annualCtc: 500000,
    employmentType: 'Full-time',
  });
  const companyId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  const offer = {
    _id: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    companyId,
    jobId,
    status: 'issued',
    privatePdf: { storedFileName: file.storedFileName, originalFileName: file.originalFileName },
  };
  OfferLetter.findById = async () => offer;
  Recruiter.findOne = async () => ({ companyId, approvalStatus: 'approved' });
  Job.findOne = () => ({ select: async () => null });
  try {
    const denied = response();
    await offerController.downloadOfferPdf({
      params: { id: offer._id.toString() },
      query: {},
      user: { _id: new mongoose.Types.ObjectId(), role: 'recruiter' },
    }, denied);
    assert.equal(denied.statusCode, 403);

    const allowed = response();
    const originalStudentFindOne = Student.findOne;
    Student.findOne = () => ({ select: async () => ({ _id: offer.studentId }) });
    try {
      await offerController.downloadOfferPdf({
        params: { id: offer._id.toString() },
        query: { download: 'true' },
        user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
      }, allowed);
      assert.equal(allowed.statusCode, 200);
      assert.equal(allowed.filePath, file.storedFilePath);
      assert.match(allowed.headers['Content-Disposition'], /^attachment;/);
    } finally {
      Student.findOne = originalStudentFindOne;
    }
  } finally {
    OfferLetter.findById = originalFindById;
    Recruiter.findOne = originalRecruiterFindOne;
    Job.findOne = originalJobFindOne;
    offerService.removeOfferLetterPdf(file.storedFileName);
  }
});
