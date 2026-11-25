const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Company = require('../src/models/Company.model');
const Job = require('../src/models/Job.model');
const Interview = require('../src/models/Interview.model');
const adminController = require('../src/controllers/admin.controller');
const interviewController = require('../src/controllers/interview.controller');

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
});

test('admin analytics and details routes are mounted', () => {
  const router = require('../src/routes/admin.routes');
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods).join(',')}:${layer.route.path}`);
  assert.ok(paths.includes('get:/analytics'));
  assert.ok(paths.includes('get:/companies/:id'));
  assert.ok(paths.includes('get:/jobs/:id'));
});

test('company approval appends history and preserves previous status', async () => {
  const originalFindById = Company.findById;
  const company = new Company({
    name: 'Dashboard Company',
    industry: 'Technology',
    location: 'Murthal',
    hrName: 'HR',
    hrEmail: 'hr@example.com',
    contactNumber: '1234567890',
    addedBy: new mongoose.Types.ObjectId(),
  });
  company.save = async function () { return this; };
  Company.findById = async () => company;
  try {
    const res = createResponse();
    await adminController.updateCompanyStatus(
      {
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { status: 'active', remarks: 'Verified documents' },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(company.status, 'active');
    assert.equal(company.approvalHistory.length, 1);
    assert.equal(company.approvalHistory[0].action, 'approved');
    assert.equal(company.approvalHistory[0].remarks, 'Verified documents');
  } finally {
    Company.findById = originalFindById;
  }
});

test('job approval appends actor and publication state', async () => {
  const originalFindById = Job.findById;
  const job = new Job({
    companyId: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    createdByRole: 'recruiter',
    title: 'Graduate Engineer',
    description: 'A valid graduate engineering role',
    location: 'Murthal',
    targetGraduationYear: 2027,
    vacancies: 2,
    applicationDeadline: new Date(Date.now() + 86400000),
    approvalStatus: 'pending',
  });
  job.save = async function () { return this; };
  Job.findById = async () => job;
  try {
    const res = createResponse();
    await adminController.updateJobApproval(
      {
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { approvalStatus: 'approved', remarks: 'Approved after review' },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(job.approvalStatus, 'approved');
    assert.equal(job.status, 'active');
    assert.equal(job.isPublished, true);
    assert.equal(job.approvalHistory.length, 1);
  } finally {
    Job.findById = originalFindById;
  }
});

test('invalid company and job detail IDs return 400', async () => {
  const companyRes = createResponse();
  await adminController.getCompanyDetails(
    { params: { id: 'invalid' }, query: {} },
    companyRes,
  );
  assert.equal(companyRes.statusCode, 400);

  const jobRes = createResponse();
  await adminController.getJobDetails(
    { params: { id: 'invalid' }, query: {} },
    jobRes,
  );
  assert.equal(jobRes.statusCode, 400);
});

test('duplicate interview round is rejected', async () => {
  const Application = require('../src/models/Application.model');
  const Recruiter = require('../src/models/Recruiter.model');
  const Student = require('../src/models/Student.model');
  const originalAppFindById = Application.findById;
  const originalInterviewFindOne = Interview.findOne;
  Application.findById = async () => ({
    _id: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
  });
  Interview.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), round: 'Technical' });
  try {
    const res = createResponse();
    await interviewController.createInterview(
      {
        body: {
          applicationId: new mongoose.Types.ObjectId().toString(),
          round: 'Technical',
          mode: 'Online',
          scheduledAt: new Date(),
        },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      },
      res,
    );
    assert.equal(res.statusCode, 409);
  } finally {
    Application.findById = originalAppFindById;
    Interview.findOne = originalInterviewFindOne;
  }
  void Recruiter;
  void Student;
});
