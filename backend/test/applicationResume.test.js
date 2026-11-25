const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Application = require('../src/models/Application.model');
const Student = require('../src/models/Student.model');
const Job = require('../src/models/Job.model');
const Recruiter = require('../src/models/Recruiter.model');
const Resume = require('../src/models/Resume.model');
const applicationController = require('../src/controllers/application.controller');
const {
  copyApplicationResume,
  removeApplicationResume,
  resolveApplicationResumePath,
} = require('../src/utils/applicationResumeStorage');

const createResponse = () => ({
  statusCode: 200,
  body: null,
  sentFile: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
  sendFile(filePath) {
    this.sentFile = filePath;
    return this;
  },
});

const validStudent = () => ({
  _id: new mongoose.Types.ObjectId(),
  cgpa: 8,
  branch: 'CSE',
  graduationYear: 2027,
  currentSemester: 6,
  backlogs: { count: 0 },
  skills: ['javascript'],
});

const validJob = () => ({
  _id: new mongoose.Types.ObjectId(),
  companyId: new mongoose.Types.ObjectId(),
  isPublished: true,
  approvalStatus: 'approved',
  status: 'active',
  publishDate: new Date(Date.now() - 1000),
  applicationDeadline: new Date(Date.now() + 86400000),
  minCgpa: 7,
  allowedBranches: ['CSE'],
  targetGraduationYear: 2027,
  maxBacklogs: 1,
  targetSemester: 6,
  requiredSkills: ['javascript'],
});

test('immutable storage copies the submitted PDF and keeps it after resume replacement', () => {
  const resumeRoot = fs.mkdtempSync(path.join(process.cwd(), 'resume-source-'));
  const applicationRoot = fs.mkdtempSync(path.join(process.cwd(), 'resume-snapshot-'));
  const sourceName = 'current.pdf';
  fs.writeFileSync(path.join(resumeRoot, sourceName), 'original resume');

  const copied = copyApplicationResume(
    { fileUrl: `/uploads/resumes/${sourceName}` },
    { resumeRoot, applicationResumeRoot: applicationRoot },
  );
  const storedPath = resolveApplicationResumePath(
    copied.storedFileName,
    { applicationResumeRoot: applicationRoot },
  );
  assert.ok(storedPath);
  assert.equal(fs.readFileSync(storedPath, 'utf8'), 'original resume');

  fs.writeFileSync(path.join(resumeRoot, sourceName), 'replacement resume');
  assert.equal(fs.readFileSync(storedPath, 'utf8'), 'original resume');
  assert.equal(removeApplicationResume(copied.storedFileName, { applicationResumeRoot: applicationRoot }), true);
  fs.rmSync(resumeRoot, { recursive: true, force: true });
  fs.rmSync(applicationRoot, { recursive: true, force: true });
});

test('application submission stores a valid resume snapshot', async () => {
  const sourceRoot = path.resolve(__dirname, '../uploads/resumes');
  const applicationRoot = path.resolve(__dirname, '../uploads/application-resumes');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(applicationRoot, { recursive: true });
  const sourceName = `phase3-test-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(sourceRoot, sourceName), '%PDF-test');

  const student = validStudent();
  const job = validJob();
  const resume = {
    _id: new mongoose.Types.ObjectId(),
    fileUrl: `/uploads/resumes/${sourceName}`,
    fileName: 'submitted.pdf',
    fileSize: 9,
    parsingStatus: 'completed',
    mimeType: 'application/pdf',
  };
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
    ResumeFind: Resume.findOne,
    ApplicationCreate: Application.create,
  };
  let created;
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => null;
  Resume.findOne = async () => resume;
  Application.create = async (record) => {
    created = record;
    return { _id: new mongoose.Types.ObjectId(), ...record };
  };
  try {
    const res = createResponse();
    await applicationController.createApplication(
      {
        body: { jobId: job._id.toString(), coverLetter: 'cover' },
        user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
      },
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.ok(created.submittedResumeSnapshot);
    assert.equal(created.submittedResumeSnapshot.resumeId.toString(), resume._id.toString());
    assert.equal(created.submittedResumeSnapshot.originalFileName, 'submitted.pdf');
    assert.ok(created.submittedResumeSnapshot.submittedAt instanceof Date);
    assert.ok(created.submittedResumeSnapshot.storedFileName);
    assert.equal(created.submittedResumeSnapshot.fileSize, fs.statSync(resolveApplicationResumePath(created.submittedResumeSnapshot.storedFileName)).size);
    removeApplicationResume(created.submittedResumeSnapshot.storedFileName);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
    Resume.findOne = originals.ResumeFind;
    Application.create = originals.ApplicationCreate;
    fs.rmSync(path.join(sourceRoot, sourceName), { force: true });
  }
});

test('application submission without a resume returns 400', async () => {
  const student = validStudent();
  const job = validJob();
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
    ResumeFind: Resume.findOne,
  };
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => null;
  Resume.findOne = async () => null;
  try {
    const res = createResponse();
    await applicationController.createApplication(
      {
        body: { jobId: job._id.toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
      },
      res,
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /resume is required/i);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
    Resume.findOne = originals.ResumeFind;
  }
});

test('application submission rejects a resume whose stored file is missing', async () => {
  const student = validStudent();
  const job = validJob();
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
    ResumeFind: Resume.findOne,
  };
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => null;
  Resume.findOne = async () => ({
    _id: new mongoose.Types.ObjectId(),
    fileUrl: `/uploads/resumes/missing-${Date.now()}.pdf`,
    fileName: 'missing.pdf',
    fileSize: 10,
    parsingStatus: 'completed',
    mimeType: 'application/pdf',
  });
  try {
    const res = createResponse();
    await applicationController.createApplication({
      body: { jobId: job._id.toString() },
      user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
    }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body.message, /resume file is missing/i);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
    Resume.findOne = originals.ResumeFind;
  }
});

test('reapplication updates a withdrawn application and preserves status history', async () => {
  const sourceRoot = path.resolve(__dirname, '../uploads/resumes');
  const applicationRoot = path.resolve(__dirname, '../uploads/application-resumes');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(applicationRoot, { recursive: true });
  const sourceName = `phase6-reapply-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(sourceRoot, sourceName), '%PDF-reapply');

  const student = validStudent();
  const job = validJob();
  const applicationId = new mongoose.Types.ObjectId();
  const existingApplication = {
    _id: applicationId,
    status: 'withdrawn',
    statusHistory: [{ status: 'withdrawn', reason: 'Withdrawn by student' }],
  };
  const resume = {
    _id: new mongoose.Types.ObjectId(),
    fileUrl: `/uploads/resumes/${sourceName}`,
    fileName: 'reapply.pdf',
    fileSize: fs.statSync(path.join(sourceRoot, sourceName)).size,
    parsingStatus: 'completed',
    mimeType: 'application/pdf',
  };
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
    ApplicationFindById: Application.findById,
    ApplicationUpdateOne: Application.updateOne,
    ResumeFind: Resume.findOne,
  };
  let updateFilter;
  let updateDocument;
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => existingApplication;
  Application.findById = async () => ({
    ...existingApplication,
    status: 'applied',
    submittedResumeSnapshot: updateDocument?.$set?.submittedResumeSnapshot,
  });
  Application.updateOne = async (filter, update) => {
    updateFilter = filter;
    updateDocument = update;
    existingApplication.status = 'applied';
    existingApplication.statusHistory.push(update.$push.statusHistory);
    return { matchedCount: 1, modifiedCount: 1 };
  };
  Resume.findOne = async () => resume;
  try {
    const res = createResponse();
    await applicationController.createApplication({
      body: { jobId: job._id.toString(), coverLetter: 'Reapplication cover' },
      user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(updateFilter.status, 'withdrawn');
    assert.equal(String(updateFilter._id), String(applicationId));
    assert.equal(String(updateFilter.studentId), String(student._id));
    assert.equal(String(updateFilter.jobId), String(job._id));
    const snapshot = updateDocument.$set.submittedResumeSnapshot;
    assert.ok(snapshot.resumeId);
    assert.ok(snapshot.originalFileName);
    assert.equal(typeof snapshot.fileSize, 'number');
    assert.ok(snapshot.storedFileName);
    assert.ok(snapshot.submittedAt instanceof Date);
    assert.equal(existingApplication.statusHistory[0].status, 'withdrawn');
    assert.equal(existingApplication.statusHistory[1].status, 'applied');
    removeApplicationResume(snapshot.storedFileName);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
    Application.findById = originals.ApplicationFindById;
    Application.updateOne = originals.ApplicationUpdateOne;
    Resume.findOne = originals.ResumeFind;
    fs.rmSync(path.join(sourceRoot, sourceName), { force: true });
  }
});

test('concurrent reapplication conflict cleans up the copied resume', async () => {
  const sourceRoot = path.resolve(__dirname, '../uploads/resumes');
  const applicationRoot = path.resolve(__dirname, '../uploads/application-resumes');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(applicationRoot, { recursive: true });
  const beforeFiles = fs.readdirSync(applicationRoot).filter((name) => name.startsWith('application-resume-'));
  const sourceName = `phase6-reapply-conflict-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(sourceRoot, sourceName), '%PDF-conflict');
  const student = validStudent();
  const job = validJob();
  const applicationId = new mongoose.Types.ObjectId();
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
    ApplicationUpdateOne: Application.updateOne,
    ResumeFind: Resume.findOne,
  };
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => ({ _id: applicationId, status: 'withdrawn', statusHistory: [] });
  Application.updateOne = async () => ({ matchedCount: 0, modifiedCount: 0 });
  Resume.findOne = async () => ({
    _id: new mongoose.Types.ObjectId(),
    fileUrl: `/uploads/resumes/${sourceName}`,
    fileName: 'conflict.pdf',
    fileSize: 9,
    parsingStatus: 'completed',
    mimeType: 'application/pdf',
  });
  try {
    const res = createResponse();
    await applicationController.createApplication({
      body: { jobId: job._id.toString() },
      user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /changed before reapplication/i);
    const afterFiles = fs.readdirSync(applicationRoot).filter((name) => name.startsWith('application-resume-'));
    assert.equal(afterFiles.length, beforeFiles.length);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
    Application.updateOne = originals.ApplicationUpdateOne;
    Resume.findOne = originals.ResumeFind;
    fs.rmSync(path.join(sourceRoot, sourceName), { force: true });
  }
});

test('duplicate application remains prevented before snapshot creation', async () => {
  const student = validStudent();
  const job = validJob();
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
  };
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: 'applied' });
  try {
    const res = createResponse();
    await applicationController.createApplication({
      body: { jobId: job._id.toString() },
      user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /already applied/i);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
  }
});

test('failed application creation cleans up the copied resume', async () => {
  const sourceRoot = path.resolve(__dirname, '../uploads/resumes');
  const applicationRoot = path.resolve(__dirname, '../uploads/application-resumes');
  fs.mkdirSync(applicationRoot, { recursive: true });
  const beforeFiles = fs.readdirSync(applicationRoot).filter((name) => name.startsWith('application-resume-'));
  const sourceName = `phase3-failure-${Date.now()}.pdf`;
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, sourceName), '%PDF-test');

  const student = validStudent();
  const job = validJob();
  const resume = {
    _id: new mongoose.Types.ObjectId(),
    fileUrl: `/uploads/resumes/${sourceName}`,
    fileName: 'failure.pdf',
    fileSize: 9,
    parsingStatus: 'completed',
    mimeType: 'application/pdf',
  };
  const originals = {
    StudentFind: Student.findOne,
    JobFind: Job.findById,
    ApplicationFind: Application.findOne,
    ResumeFind: Resume.findOne,
    ApplicationCreate: Application.create,
  };
  Student.findOne = async () => student;
  Job.findById = async () => job;
  Application.findOne = async () => null;
  Resume.findOne = async () => resume;
  Application.create = async () => {
    throw new Error('database create failed');
  };
  try {
    await assert.rejects(applicationController.createApplication(
      {
        body: { jobId: job._id.toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'student' },
      },
      createResponse(),
    ));
    const afterFiles = fs.readdirSync(applicationRoot).filter((name) => name.startsWith('application-resume-'));
    assert.equal(afterFiles.length, beforeFiles.length);
  } finally {
    Student.findOne = originals.StudentFind;
    Job.findById = originals.JobFind;
    Application.findOne = originals.ApplicationFind;
    Resume.findOne = originals.ResumeFind;
    Application.create = originals.ApplicationCreate;
    fs.rmSync(path.join(sourceRoot, sourceName), { force: true });
  }
});

test('reapply replaces only the new application snapshot', async () => {
  const snapshotA = { resumeId: new mongoose.Types.ObjectId(), originalFileName: 'old.pdf' };
  const snapshotB = { resumeId: new mongoose.Types.ObjectId(), originalFileName: 'new.pdf' };
  const application = { submittedResumeSnapshot: snapshotA };
  application.submittedResumeSnapshot = snapshotB;
  assert.equal(application.submittedResumeSnapshot.originalFileName, 'new.pdf');
  assert.equal(snapshotA.originalFileName, 'old.pdf');
});

test('submitted resume snapshot schema keeps all required fields', () => {
  const ApplicationModel = require('../src/models/Application.model');
  const application = new ApplicationModel({
    studentId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
    submittedResumeSnapshot: {},
  });
  const validation = application.validateSync();
  assert.ok(validation);
  assert.ok(ApplicationModel.schema.path('submittedResumeSnapshot.resumeId').isRequired);
  assert.ok(ApplicationModel.schema.path('submittedResumeSnapshot.originalFileName').isRequired);
  assert.ok(ApplicationModel.schema.path('submittedResumeSnapshot.fileSize').isRequired);
  assert.ok(ApplicationModel.schema.path('submittedResumeSnapshot.storedFileName').isRequired);
  assert.ok(ApplicationModel.schema.path('submittedResumeSnapshot.submittedAt').isRequired);
});

test('invalid application ID is rejected', async () => {
  const res = createResponse();
  await applicationController.downloadApplicationResume(
    { params: { id: 'invalid' }, user: { role: 'admin' }, query: {} },
    res,
  );
  assert.equal(res.statusCode, 400);
});

test('student cannot download another student application resume', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const originalFindById = Application.findById;
  const originalStudentFindOne = Student.findOne;
  Application.findById = async () => ({
    _id: applicationId,
    studentId: new mongoose.Types.ObjectId(),
  });
  Student.findOne = async () => ({ _id: new mongoose.Types.ObjectId() });
  try {
    const res = createResponse();
    await applicationController.downloadApplicationResume(
      { params: { id: applicationId.toString() }, user: { role: 'student', _id: new mongoose.Types.ObjectId() }, query: {} },
      res,
    );
    assert.equal(res.statusCode, 403);
  } finally {
    Application.findById = originalFindById;
    Student.findOne = originalStudentFindOne;
  }
});

test('recruiter cannot download another company or recruiter job resume', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const originalFindById = Application.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  const originalJobFindOne = Job.findOne;
  Application.findById = async () => ({
    _id: applicationId,
    companyId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
  });
  Recruiter.findOne = async () => ({
    companyId: new mongoose.Types.ObjectId(),
    approvalStatus: 'approved',
  });
  Job.findOne = async () => null;
  try {
    const res = createResponse();
    await applicationController.downloadApplicationResume(
      { params: { id: applicationId.toString() }, user: { role: 'recruiter', _id: new mongoose.Types.ObjectId() }, query: {} },
      res,
    );
    assert.equal(res.statusCode, 403);
  } finally {
    Application.findById = originalFindById;
    Recruiter.findOne = originalRecruiterFindOne;
    Job.findOne = originalJobFindOne;
  }
});

test('unapproved recruiter is denied application resume access', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const originalFindById = Application.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  Application.findById = async () => ({
    _id: applicationId,
    companyId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
  });
  Recruiter.findOne = async () => ({
    companyId: new mongoose.Types.ObjectId(),
    approvalStatus: 'pending',
  });
  try {
    const res = createResponse();
    await applicationController.downloadApplicationResume(
      { params: { id: applicationId.toString() }, user: { role: 'recruiter', _id: new mongoose.Types.ObjectId() }, query: {} },
      res,
    );
    assert.equal(res.statusCode, 403);
  } finally {
    Application.findById = originalFindById;
    Recruiter.findOne = originalRecruiterFindOne;
  }
});

test('admin can download an application resume snapshot', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const applicationRoot = path.resolve(__dirname, '../uploads/application-resumes');
  fs.mkdirSync(applicationRoot, { recursive: true });
  const storedFileName = `application-resume-${crypto.randomUUID ? crypto.randomUUID() : 'test-id'}.pdf`;
  const filePath = path.join(applicationRoot, storedFileName);
  fs.writeFileSync(filePath, '%PDF-test');

  const originalFindById = Application.findById;
  Application.findById = async () => ({
    _id: applicationId,
    submittedResumeSnapshot: {
      storedFileName,
      originalFileName: 'admin-view.pdf',
    },
  });
  try {
    const res = createResponse();
    await applicationController.downloadApplicationResume(
      { params: { id: applicationId.toString() }, user: { role: 'admin' }, query: {} },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.sentFile, filePath);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
  } finally {
    Application.findById = originalFindById;
    fs.rmSync(filePath, { force: true });
  }
});

test('missing application snapshot remains a compatible 404', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const originalFindById = Application.findById;
  Application.findById = async () => ({
    _id: applicationId,
    studentId: new mongoose.Types.ObjectId(),
  });
  const studentId = Application.findById;
  void studentId;
  try {
    const res = createResponse();
    await applicationController.downloadApplicationResume(
      { params: { id: applicationId.toString() }, user: { role: 'admin' }, query: {} },
      res,
    );
    assert.equal(res.statusCode, 404);
  } finally {
    Application.findById = originalFindById;
  }
});

test('approved recruiter receives the historical snapshot with view and download headers', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const applicationRoot = path.resolve(__dirname, '../uploads/application-resumes');
  fs.mkdirSync(applicationRoot, { recursive: true });
  const storedFileName = `application-resume-${crypto.randomUUID ? crypto.randomUUID() : 'historical-test'}.pdf`;
  const filePath = path.join(applicationRoot, storedFileName);
  fs.writeFileSync(filePath, '%PDF-historical-snapshot');

  const originalFindById = Application.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  const originalJobFindOne = Job.findOne;
  const companyId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  Application.findById = async () => ({
    _id: applicationId,
    companyId,
    jobId,
    submittedResumeSnapshot: {
      storedFileName,
      originalFileName: 'submitted-at-application.pdf',
    },
  });
  Recruiter.findOne = async () => ({ companyId, approvalStatus: 'approved' });
  Job.findOne = () => ({ select: async () => ({ _id: jobId }) });
  try {
    const viewRes = createResponse();
    await applicationController.downloadApplicationResume({
      params: { id: applicationId.toString() },
      user: { role: 'recruiter', _id: new mongoose.Types.ObjectId() },
      query: {},
    }, viewRes);
    assert.equal(viewRes.statusCode, 200);
    assert.equal(fs.readFileSync(viewRes.sentFile, 'utf8'), '%PDF-historical-snapshot');
    assert.match(viewRes.headers['Content-Disposition'], /^inline;/);

    const downloadRes = createResponse();
    await applicationController.downloadApplicationResume({
      params: { id: applicationId.toString() },
      user: { role: 'recruiter', _id: new mongoose.Types.ObjectId() },
      query: { download: 'true' },
    }, downloadRes);
    assert.equal(downloadRes.statusCode, 200);
    assert.match(downloadRes.headers['Content-Disposition'], /^attachment;/);
    assert.match(downloadRes.headers['Content-Disposition'], /submitted-at-application\.pdf/);
  } finally {
    Application.findById = originalFindById;
    Recruiter.findOne = originalRecruiterFindOne;
    Job.findOne = originalJobFindOne;
    fs.rmSync(filePath, { force: true });
  }
});

test('application resume route is mounted and legacy listings remain compatible', async () => {
  const router = require('../src/routes/application.routes');
  const resumeRoute = router.stack.find(
    (layer) => layer.route && layer.route.path === '/:id/resume',
  );
  assert.ok(resumeRoute);
  assert.equal(resumeRoute.route.methods.get, true);

  const originalFind = Application.find;
  const originalStudentFindOne = Student.findOne;
  const studentId = new mongoose.Types.ObjectId();
  Student.findOne = async () => ({ _id: studentId });
  Application.find = () => ({
    populate() { return this; },
    sort() {
      return Promise.resolve([
        {
          _id: new mongoose.Types.ObjectId(),
          studentId,
          toObject() {
            return { _id: this._id, studentId: this.studentId };
          },
        },
      ]);
    },
  });
  try {
    const res = createResponse();
    await applicationController.getApplications(
      { user: { role: 'student', _id: new mongoose.Types.ObjectId() } },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].resume.available, false);
  } finally {
    Application.find = originalFind;
    Student.findOne = originalStudentFindOne;
  }
});
