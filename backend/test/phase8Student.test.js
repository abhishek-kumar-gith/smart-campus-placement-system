const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Job = require('../src/models/Job.model');
const Student = require('../src/models/Student.model');
const Notification = require('../src/models/Notification.model');
const jobController = require('../src/controllers/job.controller');
const notificationController = require('../src/controllers/notification.controller');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('student job browse filters approved drives server-side and returns eligible paginated records', async () => {
  const originalFind = Job.find;
  const originalCount = Job.countDocuments;
  const originalStudentFind = Student.findOne;
  const studentId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  let filter;
  const job = {
    _id: new mongoose.Types.ObjectId(),
    companyId: { name: 'Example Company' },
    allowedBranches: ['CSE'],
    minCgpa: 7,
    targetGraduationYear: 2027,
    maxBacklogs: 0,
    toObject() {
      return {
        _id: this._id,
        companyId: this.companyId,
        allowedBranches: this.allowedBranches,
        minCgpa: this.minCgpa,
        targetGraduationYear: this.targetGraduationYear,
        maxBacklogs: this.maxBacklogs,
      };
    },
  };
  Job.find = (receivedFilter) => {
    filter = receivedFilter;
    return {
      populate() { return this; },
      sort() { return this; },
      skip() { return this; },
      limit: async () => [job],
    };
  };
  Job.countDocuments = async () => 21;
  Student.findOne = async () => ({
    _id: studentId,
    userId,
    branch: 'CSE',
    cgpa: 8,
    graduationYear: 2027,
    currentSemester: 7,
    backlogs: { count: 0 },
  });
  try {
    const res = response();
    await jobController.getJobs({
      user: { _id: userId, role: 'student' },
      query: {
        page: '2',
        pageSize: '10',
        search: 'engineer',
        branch: 'CSE',
        location: 'sonipat',
        jobType: 'Full-time',
        minCtc: '500000',
      },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.records.length, 1);
    assert.equal(res.body.data.records[0].eligibility.eligible, true);
    assert.equal(res.body.data.pagination.page, 2);
    assert.equal(filter.allowedBranches, 'CSE');
    assert.equal(filter.location.test('Sonipat'), true);
    assert.equal(filter.jobType, 'Full-time');
    assert.equal(filter['package.max'].$gte, 500000);
    assert.equal(filter.$and[0].$or[0].title.test('Engineer'), true);
  } finally {
    Job.find = originalFind;
    Job.countDocuments = originalCount;
    Student.findOne = originalStudentFind;
  }
});

test('student notifications include user and legacy profile recipient IDs and unread state', async () => {
  const originalStudentFind = Student.findOne;
  const originalNotificationFind = Notification.find;
  const originalNotificationCount = Notification.countDocuments;
  const userId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  let queryFilter;
  Student.findOne = () => ({ select: async () => ({ _id: studentId }) });
  Notification.find = (filter) => {
    queryFilter = filter;
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: async () => [{ _id: new mongoose.Types.ObjectId(), isRead: false }],
    };
  };
  Notification.countDocuments = async () => 1;
  try {
    const res = response();
    await notificationController.getNotifications({
      user: { _id: userId, role: 'student' },
      query: { unread: 'true', page: '1', pageSize: '20' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.records[0].isRead, false);
    assert.equal(res.body.data.unread, 1);
    assert.ok(queryFilter.recipientIds.$in.some((id) => String(id) === String(userId)));
    assert.ok(queryFilter.recipientIds.$in.some((id) => String(id) === String(studentId)));
    assert.ok(queryFilter.$or.some((condition) => condition.isRead === false));
  } finally {
    Student.findOne = originalStudentFind;
    Notification.find = originalNotificationFind;
    Notification.countDocuments = originalNotificationCount;
  }
});

test('notification read updates are scoped to the current student recipient', async () => {
  const originalStudentFind = Student.findOne;
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const userId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  let filter;
  Student.findOne = () => ({ select: async () => ({ _id: studentId }) });
  Notification.findOneAndUpdate = async (receivedFilter, update) => {
    filter = receivedFilter;
    assert.equal(update.$set.isRead, true);
    return { _id: receivedFilter._id, isRead: true };
  };
  try {
    const res = response();
    await notificationController.markNotificationRead({
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: userId, role: 'student' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(filter.recipientIds.$in.some((id) => String(id) === String(userId)));
    assert.ok(filter.recipientIds.$in.some((id) => String(id) === String(studentId)));
  } finally {
    Student.findOne = originalStudentFind;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('student profile and job browse routes are mounted', () => {
  const studentRouter = require('../src/routes/student.routes');
  const jobRouter = require('../src/routes/job.routes');
  const studentRoutes = studentRouter.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods).join(',')}:${layer.route.path}`);
  const jobRoutes = jobRouter.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods).join(',')}:${layer.route.path}`);
  assert.ok(studentRoutes.includes('get:/applications'));
  assert.ok(studentRoutes.includes('patch:/profile'));
  assert.ok(jobRoutes.includes('get:/browse'));
});
