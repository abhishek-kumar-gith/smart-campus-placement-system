const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const recruiterController = require('../src/controllers/recruiter.controller');
const applicationController = require('../src/controllers/application.controller');
const Application = require('../src/models/Application.model');
const Recruiter = require('../src/models/Recruiter.model');
const Job = require('../src/models/Job.model');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('Phase 6 recruiter routes expose dashboard, applications, directory, and company profile', () => {
  const router = require('../src/routes/recruiter.routes');
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods).join(',')}:${layer.route.path}`);
  assert.ok(routes.includes('get:/dashboard'));
  assert.ok(routes.includes('get:/applications'));
  assert.ok(routes.includes('get:/students'));
  assert.ok(routes.includes('patch:/company'));
});

test('recruiter application status transitions reject inconsistent updates', async () => {
  const originalApplicationFindById = Application.findById;
  const originalRecruiterFindOne = Recruiter.findOne;
  const originalJobFindOne = Job.findOne;
  const application = {
    status: 'applied',
    companyId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
    statusHistory: [],
  };
  Application.findById = async () => application;
  Recruiter.findOne = async () => ({
    companyId: application.companyId,
    approvalStatus: 'approved',
  });
  Job.findOne = () => ({ select: async () => ({ _id: application.jobId }) });
  try {
    const res = response();
    await applicationController.updateApplicationStatus({
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { status: 'selected' },
      user: { _id: new mongoose.Types.ObjectId(), role: 'recruiter' },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(application.status, 'applied');
  } finally {
    Application.findById = originalApplicationFindById;
    Recruiter.findOne = originalRecruiterFindOne;
    Job.findOne = originalJobFindOne;
  }
});

test('recruiter company profile updates use the authenticated recruiter company', async () => {
  const originalRecruiterFindOne = Recruiter.findOne;
  const originalCompanyFindOneAndUpdate = require('../src/models/Company.model').findOneAndUpdate;
  const companyId = new mongoose.Types.ObjectId();
  let filter;
  Recruiter.findOne = async () => ({ companyId, approvalStatus: 'approved' });
  require('../src/models/Company.model').findOneAndUpdate = async (receivedFilter, update) => {
    filter = receivedFilter;
    return { _id: companyId, ...update };
  };
  try {
    const res = response();
    await recruiterController.updateCompanyProfile({
      user: { _id: new mongoose.Types.ObjectId() },
      body: { description: 'Updated profile' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(String(filter._id), String(companyId));
    assert.equal(res.body.data.description, 'Updated profile');
  } finally {
    Recruiter.findOne = originalRecruiterFindOne;
    require('../src/models/Company.model').findOneAndUpdate = originalCompanyFindOneAndUpdate;
  }
});
