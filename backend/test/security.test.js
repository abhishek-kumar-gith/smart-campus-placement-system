const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../src/app');
const Job = require('../src/models/Job.model');
const Recruiter = require('../src/models/Recruiter.model');
const Interview = require('../src/models/Interview.model');
const Resume = require('../src/models/Resume.model');
const Student = require('../src/models/Student.model');
const jobController = require('../src/controllers/job.controller');
const interviewController = require('../src/controllers/interview.controller');
const resumeController = require('../src/controllers/resume.controller');

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  download() {
    throw new Error('download should not be reached');
  },
});

test('resume route exposes only a protected download endpoint', () => {
  const router = require('../src/routes/resume.routes');
  const downloadRoute = router.stack.find(
    (layer) => layer.route && layer.route.path === '/:id/download',
  );
  assert.ok(downloadRoute);
  assert.equal(downloadRoute.route.methods.get, true);
  assert.ok(downloadRoute.route.stack.length >= 2);
});

test('public job detail rejects unpublished or unapproved jobs', async () => {
  const originalFindOne = Job.findOne;
  let receivedFilter;
  Job.findOne = (filter) => {
    receivedFilter = filter;
    return {
      populate() {
        return Promise.resolve(null);
      },
    };
  };
  try {
    const res = createResponse();
    await jobController.getJob(
      { params: { id: new mongoose.Types.ObjectId().toString() }, user: undefined },
      res,
    );
    assert.equal(res.statusCode, 404);
    assert.equal(receivedFilter.isPublished, true);
    assert.equal(receivedFilter.approvalStatus, 'approved');
    assert.equal(receivedFilter.status, 'active');
  } finally {
    Job.findOne = originalFindOne;
  }
});

test('recruiter cannot update another recruiter interview', async () => {
  const originalFindById = Interview.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  Interview.findById = async () => ({
    companyId: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
  });
  Recruiter.findOne = async () => ({
    companyId: new mongoose.Types.ObjectId(),
  });
  try {
    const res = createResponse();
    await interviewController.updateInterviewStatus(
      {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: {
          _id: new mongoose.Types.ObjectId(),
          role: 'recruiter',
        },
        body: { status: 'completed' },
      },
      res,
    );
    assert.equal(res.statusCode, 403);
  } finally {
    Interview.findById = originalFindById;
    Recruiter.findOne = originalRecruiterFindOne;
  }
});

test('student cannot download another student resume', async () => {
  const originalResumeFindById = Resume.findById;
  const originalStudentFindOne = Student.findOne;
  const resumeStudentId = new mongoose.Types.ObjectId();
  const ownStudentId = new mongoose.Types.ObjectId();
  Resume.findById = async () => ({
    studentId: resumeStudentId,
    fileUrl: '/uploads/resumes/test.pdf',
    fileName: 'test.pdf',
  });
  Student.findOne = async () => ({ _id: ownStudentId });
  try {
    const res = createResponse();
    await resumeController.downloadResume(
      {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: {
          _id: new mongoose.Types.ObjectId(),
          role: 'student',
        },
      },
      res,
    );
    assert.equal(res.statusCode, 403);
  } finally {
    Resume.findById = originalResumeFindById;
    Student.findOne = originalStudentFindOne;
  }
});

test('app mounts resume download and excludes public /uploads/resumes static path', () => {
  const resumeRoute = app._router.stack.some(
    (layer) => layer.regexp && layer.regexp.source.includes('resumes'),
  );
  assert.equal(resumeRoute, true);
  const publicResumeStatic = app._router.stack.some(
    (layer) => layer.regexp
      && layer.regexp.source.includes('uploads')
      && layer.regexp.source.includes('resumes'),
  );
  assert.equal(publicResumeStatic, false);
});
