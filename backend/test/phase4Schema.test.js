const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Interview = require('../src/models/Interview.model');
const Company = require('../src/models/Company.model');
const Job = require('../src/models/Job.model');
const Notification = require('../src/models/Notification.model');
const OfferLetter = require('../src/models/OfferLetter.model');
const { up, down, findLegacyApplicationIndex } =
  require('../scripts/migrateInterviewIndexes');

test('multiple interview rounds are allowed for one application', async () => {
  const applicationId = new mongoose.Types.ObjectId();
  const modelRoundA = new Interview({
    applicationId,
    studentId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
    round: 'Technical',
    scheduledAt: new Date(),
    createdBy: new mongoose.Types.ObjectId(),
  });
  const modelRoundB = new Interview({
    applicationId,
    studentId: modelRoundA.studentId,
    jobId: modelRoundA.jobId,
    companyId: modelRoundA.companyId,
    round: 'HR',
    scheduledAt: new Date(),
    createdBy: modelRoundA.createdBy,
  });
  assert.equal(modelRoundA.validateSync(), undefined);
  assert.equal(modelRoundB.validateSync(), undefined);
  assert.equal(modelRoundA.applicationId.toString(), applicationId.toString());
  assert.equal(modelRoundB.applicationId.toString(), applicationId.toString());
});

test('interview indexes include compound application round uniqueness', () => {
  const compound = Interview.schema.indexes().find(([fields]) =>
    fields.applicationId === 1 && fields.round === 1);
  assert.ok(compound);
  assert.equal(compound[1].unique, true);
});

test('company approval history appends without replacing previous history', () => {
  const company = new Company({
    name: 'Phase Four Company',
    industry: 'Technology',
    location: 'Haryana',
    hrName: 'HR',
    hrEmail: 'hr@example.com',
    contactNumber: '1234567890',
    addedBy: new mongoose.Types.ObjectId(),
  });
  company.approvalHistory.push({
    previousStatus: 'pending',
    newStatus: 'active',
    action: 'approved',
    changedBy: new mongoose.Types.ObjectId(),
    changedByRole: 'admin',
    remarks: 'Approved',
  });
  company.approvalHistory.push({
    previousStatus: 'active',
    newStatus: 'inactive',
    action: 'rejected',
    changedBy: new mongoose.Types.ObjectId(),
    changedByRole: 'admin',
    remarks: 'Temporary hold',
  });
  assert.equal(company.approvalHistory.length, 2);
  assert.equal(company.approvalHistory[0].previousStatus, 'pending');
  assert.equal(company.approvalHistory[1].remarks, 'Temporary hold');
});

test('job approval history stores actor and remarks', () => {
  const job = new Job({
    companyId: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    createdByRole: 'recruiter',
    title: 'Software Engineer',
    description: 'Software engineering role',
    location: 'Murthal',
    targetGraduationYear: 2027,
    vacancies: 1,
    applicationDeadline: new Date(Date.now() + 86400000),
  });
  job.approvalHistory.push({
    previousApprovalStatus: 'pending',
    newApprovalStatus: 'approved',
    action: 'approved',
    changedBy: new mongoose.Types.ObjectId(),
    changedByRole: 'admin',
    remarks: 'Approved for campus drive',
  });
  assert.equal(job.approvalHistory.length, 1);
  assert.equal(job.approvalHistory[0].changedByRole, 'admin');
});

test('offer letter validates required references and private PDF metadata', () => {
  const offer = new OfferLetter({
    studentId: new mongoose.Types.ObjectId(),
    applicationId: new mongoose.Types.ObjectId(),
    jobId: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
    recruiterId: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    offerLetterNumber: 'DCRUST-OFFER-2027-0001',
    designation: 'Graduate Engineer',
    annualCtc: 8,
    offerDate: new Date(),
    privatePdf: {
      storedFileName: 'offer-private.pdf',
      originalFileName: 'Offer Letter.pdf',
      fileSize: 1024,
    },
  });
  assert.equal(offer.validateSync(), undefined);
  assert.equal(offer.status, 'generated');
  assert.equal(offer.privatePdf.originalFileName, 'Offer Letter.pdf');
});

test('offer letter has no public file URL field', () => {
  const offer = new OfferLetter();
  assert.equal(offer.toObject().publicUrl, undefined);
  assert.ok(OfferLetter.schema.path('privatePdf.storedFileName'));
});

test('notification defaults to unread and read timestamp can be set', () => {
  const notification = new Notification({
    senderId: new mongoose.Types.ObjectId(),
    recipientType: 'student',
    recipientIds: [new mongoose.Types.ObjectId()],
    subject: 'Placement update',
    message: 'Status updated',
    status: 'sent',
  });
  assert.equal(notification.isRead, false);
  assert.equal(notification.readAt, null);
  notification.isRead = true;
  notification.readAt = new Date();
  assert.equal(notification.isRead, true);
  assert.ok(notification.readAt);
});

test('legacy notification documents can be treated as unread', () => {
  const notification = new Notification({
    senderId: new mongoose.Types.ObjectId(),
    recipientType: 'student',
    subject: 'Legacy notification',
    message: 'No read state in legacy document',
    status: 'sent',
  });
  notification.isRead = undefined;
  assert.equal(notification.isRead === false || notification.isRead == null, true);
});

test('legacy index finder is exact and migration exports are present', () => {
  assert.equal(findLegacyApplicationIndex([
    { name: 'applicationId_1', unique: true, key: { applicationId: 1 } },
  ]).name, 'applicationId_1');
  assert.equal(typeof up, 'function');
  assert.equal(typeof down, 'function');
});

test('interview migration up is idempotent with legacy and compound indexes', async () => {
  let legacyPresent = true;
  let compoundPresent = false;
  let drops = 0;
  let creates = 0;
  const collection = {
    async indexes() {
      const indexes = [];
      if (legacyPresent) {
        indexes.push({
          name: 'applicationId_1',
          unique: true,
          key: { applicationId: 1 },
        });
      }
      if (compoundPresent) {
        indexes.push({
          name: 'applicationId_1_round_1',
          unique: true,
          key: { applicationId: 1, round: 1 },
        });
      }
      return indexes;
    },
    async dropIndex(name) {
      assert.equal(name, 'applicationId_1');
      legacyPresent = false;
      drops++;
    },
    async createIndex(key, options) {
      assert.deepEqual(key, { applicationId: 1, round: 1 });
      assert.equal(options.unique, true);
      compoundPresent = true;
      creates++;
    },
  };
  await up(collection);
  await up(collection);
  assert.equal(drops, 1);
  assert.equal(creates, 1);
});
