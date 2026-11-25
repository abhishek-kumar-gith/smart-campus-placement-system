const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = require('../src/app');
const User = require('../src/models/User.model');
const Student = require('../src/models/Student.model');
const Recruiter = require('../src/models/Recruiter.model');
const Job = require('../src/models/Job.model');
const Resume = require('../src/models/Resume.model');
const Application = require('../src/models/Application.model');
const Interview = require('../src/models/Interview.model');
const Notification = require('../src/models/Notification.model');
const OfferLetter = require('../src/models/OfferLetter.model');
const { generateAccessToken } = require('../src/utils/generateToken');
const { removeApplicationResume } = require('../src/utils/applicationResumeStorage');

const queryable = (value) => {
  const query = Promise.resolve(value);
  query.select = async () => value;
  return query;
};

test('authenticated API integrates student applications, recruiter interviews/offers, notifications, and private resume access', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const ids = {
    studentUser: new mongoose.Types.ObjectId(),
    otherStudentUser: new mongoose.Types.ObjectId(),
    recruiterUser: new mongoose.Types.ObjectId(),
    otherRecruiterUser: new mongoose.Types.ObjectId(),
    pendingRecruiterUser: new mongoose.Types.ObjectId(),
    adminUser: new mongoose.Types.ObjectId(),
    student: new mongoose.Types.ObjectId(),
    otherStudent: new mongoose.Types.ObjectId(),
    recruiter: new mongoose.Types.ObjectId(),
    company: new mongoose.Types.ObjectId(),
    job: new mongoose.Types.ObjectId(),
    missingSnapshotApplication: new mongoose.Types.ObjectId(),
  };
  const roles = new Map([
    [String(ids.studentUser), 'student'],
    [String(ids.otherStudentUser), 'student'],
    [String(ids.recruiterUser), 'recruiter'],
    [String(ids.otherRecruiterUser), 'recruiter'],
    [String(ids.pendingRecruiterUser), 'recruiter'],
    [String(ids.adminUser), 'admin'],
  ]);
  const tokens = Object.fromEntries([...roles].map(([id, role]) => [
    role === 'student' && id === String(ids.otherStudentUser) ? 'otherStudent'
      : role === 'recruiter' && id === String(ids.otherRecruiterUser) ? 'otherRecruiter'
        : role === 'recruiter' && id === String(ids.pendingRecruiterUser) ? 'pendingRecruiter'
          : role,
    generateAccessToken({ id }),
  ]));
  const sourceRoot = path.resolve(__dirname, '../uploads/resumes');
  const sourceFileName = `integration-${crypto.randomUUID()}.pdf`;
  const sourcePath = path.join(sourceRoot, sourceFileName);
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(sourcePath, '%PDF-historical-application-resume');

  const originals = {
    userFindById: User.findById,
    studentFindOne: Student.findOne,
    studentFindById: Student.findById,
    recruiterFindOne: Recruiter.findOne,
    jobFind: Job.find,
    jobFindById: Job.findById,
    jobFindOne: Job.findOne,
    resumeFindOne: Resume.findOne,
    applicationFind: Application.find,
    applicationFindOne: Application.findOne,
    applicationFindById: Application.findById,
    applicationCreate: Application.create,
    interviewFindOne: Interview.findOne,
    interviewCreate: Interview.create,
    notificationFind: Notification.find,
    notificationCountDocuments: Notification.countDocuments,
    notificationCreate: Notification.create,
    offerFind: OfferLetter.find,
    offerCountDocuments: OfferLetter.countDocuments,
    offerAggregate: OfferLetter.aggregate,
  };
  let applicationRecord;
  let interviewRecord;
  let offerFilter;
  let applicationListFilter;

  const studentProfile = {
    _id: ids.student,
    userId: ids.studentUser,
    fullName: 'Integration Student',
    rollNumber: 'INT-001',
    branch: 'CSE',
    cgpa: 8.2,
    graduationYear: 2027,
    currentSemester: 7,
    backlogs: { count: 0 },
    skills: ['JavaScript'],
  };
  const jobRecord = {
    _id: ids.job,
    companyId: ids.company,
    createdBy: ids.recruiterUser,
    title: 'Integration Engineer',
    description: 'Integration test placement role.',
    location: 'Sonipat',
    jobType: 'Full-time',
    requiredSkills: ['JavaScript'],
    minCgpa: 7,
    allowedBranches: ['CSE'],
    targetGraduationYear: 2027,
    maxBacklogs: 0,
    isPublished: true,
    approvalStatus: 'approved',
    status: 'active',
    publishDate: new Date(Date.now() - 86400000),
    applicationDeadline: new Date(Date.now() + 86400000),
  };

  try {
    User.findById = (id) => ({
      select: async () => ({ _id: id, role: roles.get(String(id)), isActive: true }),
    });
    Student.findOne = (filter) => queryable(
      String(filter.userId) === String(ids.studentUser) ? studentProfile
        : String(filter.userId) === String(ids.otherStudentUser)
          ? { ...studentProfile, _id: ids.otherStudent, userId: ids.otherStudentUser }
          : null,
    );
    Student.findById = () => ({
      populate: async () => ({ userId: null }),
    });
    Recruiter.findOne = async ({ userId }) => {
      if (String(userId) === String(ids.recruiterUser)) {
        return { _id: ids.recruiter, companyId: ids.company, approvalStatus: 'approved' };
      }
      if (String(userId) === String(ids.otherRecruiterUser)) {
        return { _id: new mongoose.Types.ObjectId(), companyId: ids.company, approvalStatus: 'approved' };
      }
      if (String(userId) === String(ids.pendingRecruiterUser)) {
        return { _id: new mongoose.Types.ObjectId(), companyId: ids.company, approvalStatus: 'pending' };
      }
      return null;
    };
    Job.find = () => ({ select: async () => [{ _id: ids.job }] });
    Job.findById = async () => jobRecord;
    Job.findOne = (filter) => ({
      select: async () => (
        String(filter._id) === String(ids.job)
        && String(filter.createdBy) === String(ids.recruiterUser)
          ? { _id: ids.job }
          : null
      ),
    });
    Resume.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      fileName: 'student-current-resume.pdf',
      fileUrl: `/uploads/resumes/${sourceFileName}`,
      parsingStatus: 'completed',
      mimeType: 'application/pdf',
    });
    Application.findOne = async () => null;
    Application.create = async (document) => {
      applicationRecord = {
        _id: new mongoose.Types.ObjectId(),
        ...document,
        status: 'applied',
        statusHistory: document.statusHistory,
        save: async function save() {},
        toObject() {
          const { save, toObject, ...record } = this;
          return record;
        },
      };
      return applicationRecord;
    };
    Application.findById = async (id) => {
      if (String(id) === String(ids.missingSnapshotApplication)) {
        return { _id: id, studentId: ids.student, jobId: ids.job, companyId: ids.company };
      }
      return applicationRecord;
    };
    Application.find = (filter) => {
      applicationListFilter = filter;
      return {
        populate() { return this; },
        sort: async () => applicationRecord ? [applicationRecord] : [],
      };
    };
    Interview.findOne = async () => interviewRecord || null;
    Interview.create = async (document) => {
      interviewRecord = { _id: new mongoose.Types.ObjectId(), ...document };
      return interviewRecord;
    };
    Notification.find = () => ({
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: async () => [{ _id: new mongoose.Types.ObjectId(), subject: 'Integration notification', isRead: false }],
    });
    Notification.countDocuments = async () => 1;
    Notification.create = async (document) => ({ _id: new mongoose.Types.ObjectId(), ...document });
    OfferLetter.find = (filter) => {
      offerFilter = filter;
      return {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit: async () => [{
          _id: new mongoose.Types.ObjectId(),
          privatePdf: { storedFileName: 'private-storage-name.pdf', originalFileName: 'offer.pdf', fileSize: 1200 },
          toObject() {
            return { _id: this._id, privatePdf: this.privatePdf };
          },
        }],
      };
    };
    OfferLetter.countDocuments = async () => 1;
    OfferLetter.aggregate = async () => [{ _id: 'issued', count: 1 }];

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const request = (pathName, token, options = {}) => fetch(`${baseUrl}${pathName}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const submitted = await request('/applications', tokens.student, {
      method: 'POST',
      body: JSON.stringify({ jobId: String(ids.job), coverLetter: 'Integration application.' }),
    });
    const submittedBody = await submitted.json();
    assert.equal(submitted.status, 201);
    assert.equal(submittedBody.data.submittedResumeSnapshot.originalFileName, 'student-current-resume.pdf');
    assert.equal(submittedBody.data.submittedResumeSnapshot.storedFileName.startsWith('application-resume-'), true);

    const studentApplications = await request('/applications', tokens.student);
    const studentApplicationsBody = await studentApplications.json();
    assert.equal(studentApplications.status, 200);
    assert.equal(String(applicationListFilter.studentId), String(ids.student));
    assert.equal(studentApplicationsBody.data[0].resume.available, true);

    const listedOffers = await request('/offers?page=1&pageSize=10', tokens.recruiter);
    const offersBody = await listedOffers.json();
    assert.equal(listedOffers.status, 200);
    assert.equal(String(offerFilter.companyId), String(ids.company));
    assert.deepEqual(offerFilter.jobId.$in.map(String), [String(ids.job)]);
    assert.equal(offersBody.data.records[0].privatePdf.storedFileName, undefined);

    const scheduled = await request('/interviews', tokens.recruiter, {
      method: 'POST',
      body: JSON.stringify({
        applicationId: String(applicationRecord._id),
        round: 'Technical',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        mode: 'Online',
      }),
    });
    assert.equal(scheduled.status, 201);
    assert.equal(interviewRecord.round, 'Technical');
    assert.equal(applicationRecord.status, 'interview');
    const duplicateRound = await request('/interviews', tokens.recruiter, {
      method: 'POST',
      body: JSON.stringify({
        applicationId: String(applicationRecord._id),
        round: 'Technical',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        mode: 'Online',
      }),
    });
    assert.equal(duplicateRound.status, 409);

    const notifications = await request('/notifications', tokens.student);
    const notificationsBody = await notifications.json();
    assert.equal(notifications.status, 200);
    assert.equal(notificationsBody.data.records[0].subject, 'Integration notification');

    const resumePath = `/applications/${applicationRecord._id}/resume`;
    const noToken = await request(resumePath);
    assert.equal(noToken.status, 401);
    const recruiterView = await request(resumePath, tokens.recruiter);
    assert.equal(recruiterView.status, 200);
    assert.match(recruiterView.headers.get('content-disposition'), /inline/);
    assert.equal(await recruiterView.text(), '%PDF-historical-application-resume');
    const recruiterDownload = await request(`${resumePath}?download=true`, tokens.recruiter);
    assert.equal(recruiterDownload.status, 200);
    assert.match(recruiterDownload.headers.get('content-disposition'), /attachment; filename="student-current-resume\.pdf"/);
    assert.equal(await recruiterDownload.text(), '%PDF-historical-application-resume');

    const otherRecruiter = await request(resumePath, tokens.otherRecruiter);
    assert.equal(otherRecruiter.status, 403);
    const pendingRecruiter = await request(resumePath, tokens.pendingRecruiter);
    assert.equal(pendingRecruiter.status, 403);
    const otherStudent = await request(resumePath, tokens.otherStudent);
    assert.equal(otherStudent.status, 403);
    const ownStudent = await request(resumePath, tokens.student);
    assert.equal(ownStudent.status, 200);
    const adminView = await request(resumePath, tokens.admin);
    assert.equal(adminView.status, 200);
    const missingSnapshot = await request(
      `/applications/${ids.missingSnapshotApplication}/resume`,
      tokens.recruiter,
    );
    assert.equal(missingSnapshot.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(sourcePath, { force: true });
    if (applicationRecord?.submittedResumeSnapshot?.storedFileName) {
      removeApplicationResume(applicationRecord.submittedResumeSnapshot.storedFileName);
    }
    User.findById = originals.userFindById;
    Student.findOne = originals.studentFindOne;
    Student.findById = originals.studentFindById;
    Recruiter.findOne = originals.recruiterFindOne;
    Job.find = originals.jobFind;
    Job.findById = originals.jobFindById;
    Job.findOne = originals.jobFindOne;
    Resume.findOne = originals.resumeFindOne;
    Application.find = originals.applicationFind;
    Application.findOne = originals.applicationFindOne;
    Application.findById = originals.applicationFindById;
    Application.create = originals.applicationCreate;
    Interview.findOne = originals.interviewFindOne;
    Interview.create = originals.interviewCreate;
    Notification.find = originals.notificationFind;
    Notification.countDocuments = originals.notificationCountDocuments;
    Notification.create = originals.notificationCreate;
    OfferLetter.find = originals.offerFind;
    OfferLetter.countDocuments = originals.offerCountDocuments;
    OfferLetter.aggregate = originals.offerAggregate;
  }
});
