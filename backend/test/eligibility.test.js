const test = require('node:test');
const assert = require('node:assert/strict');
const { checkEligibility } = require('../src/services/eligibilityEngine');

const student = {
  cgpa: 7.5,
  branch: 'CSE',
  graduationYear: 2027,
  currentSemester: 6,
  backlogs: { count: 0 },
};

test('eligible when every criterion matches', () => {
  const result = checkEligibility(student, {
    minCgpa: 7,
    allowedBranches: ['CSE', 'IT'],
    targetGraduationYear: 2027,
    maxBacklogs: 0,
    targetSemester: 6,
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test('returns only applicable CGPA, branch, graduation, backlog, and semester reasons', () => {
  const result = checkEligibility(
    { ...student, cgpa: 6.2, branch: 'ECE', graduationYear: 2026, currentSemester: 5, backlogs: { count: 2 } },
    {
      minCgpa: 7,
      allowedBranches: ['CSE', 'IT'],
      targetGraduationYear: 2027,
      maxBacklogs: 1,
      targetSemester: 6,
    },
  );
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.length, 5);
  assert.match(result.reasons[0], /required CGPA is 7/);
  assert.match(result.reasons[1], /branch is not eligible/);
  assert.match(result.reasons[2], /graduation year is 2027/);
  assert.match(result.reasons[3], /Maximum allowed backlogs are 1/);
  assert.match(result.reasons[4], /required semester is Sem 6/);
});

test('empty branch selection is ineligible and does not act as a wildcard', () => {
  const result = checkEligibility(student, {
    minCgpa: 0,
    allowedBranches: [],
    targetGraduationYear: 2027,
    maxBacklogs: 0,
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ['No eligible branches have been selected for this drive.']);
});

test('additional branch matches only explicitly selected branch values', () => {
  const agriculture = { ...student, branch: 'Agriculture' };
  const ece = { ...student, branch: 'ECE' };
  const job = {
    minCgpa: 0,
    allowedBranches: ['CSE', 'Agriculture'],
    targetGraduationYear: 2027,
    maxBacklogs: 0,
  };

  assert.equal(checkEligibility(agriculture, job).eligible, true);
  assert.equal(checkEligibility(ece, job).eligible, false);
});

test('missing resume snapshot fields do not affect eligibility', () => {
  const result = checkEligibility(student, {
    minCgpa: 7,
    allowedBranches: ['CSE'],
    targetGraduationYear: 2027,
    maxBacklogs: 0,
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
  assert.ok(!result.reasons.some((reason) => /submittedAt|storedFileName|resumeId|originalFileName|fileSize/i.test(reason)));
});

test('missing profile values produce criteria-specific reasons safely', () => {
  const result = checkEligibility(
    { cgpa: undefined, branch: undefined, graduationYear: undefined, currentSemester: undefined, backlogs: {} },
    {
      minCgpa: 7,
      allowedBranches: ['CSE'],
      targetGraduationYear: 2027,
      maxBacklogs: 1,
      targetSemester: 6,
    },
  );
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(' '), /CGPA/);
  assert.match(result.reasons.join(' '), /branch/);
  assert.match(result.reasons.join(' '), /graduation year/);
  assert.match(result.reasons.join(' '), /backlog/);
  assert.match(result.reasons.join(' '), /semester/);
});
