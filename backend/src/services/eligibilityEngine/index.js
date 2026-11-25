const checkEligibility = (student, job) => {
  if (!student) {
    return {
      eligible: false,
      passed: false,
      reasons: ['Student profile could not be found.'],
      matchedCriteria: {},
    };
  }

  const reasons = [];
  const matchedCriteria = {
    cgpa: true,
    branch: true,
    graduationYear: true,
    backlogs: true,
    semester: true,
  };

  const studentCgpa = Number(student.cgpa);
  const requiredCgpa = Number(job.minCgpa || 0);
  if (!Number.isFinite(studentCgpa)) {
    reasons.push('Your CGPA information is missing or invalid.');
    matchedCriteria.cgpa = false;
  } else if (requiredCgpa > 0 && studentCgpa < requiredCgpa) {
    reasons.push(`Minimum required CGPA is ${requiredCgpa}, but your CGPA is ${studentCgpa}.`);
    matchedCriteria.cgpa = false;
  }

  if (!Array.isArray(job.allowedBranches) || job.allowedBranches.length === 0) {
    reasons.push('No eligible branches have been selected for this drive.');
    matchedCriteria.branch = false;
  } else if (!student.branch || !job.allowedBranches.includes(student.branch)) {
    reasons.push('Your branch is not eligible for this drive.');
    matchedCriteria.branch = false;
  }

  const studentGraduationYear = Number(student.graduationYear);
  if (job.targetGraduationYear && (!Number.isFinite(studentGraduationYear) || studentGraduationYear !== Number(job.targetGraduationYear))) {
    reasons.push(`The required graduation year is ${job.targetGraduationYear}, but your graduation year is ${student.graduationYear}.`);
    matchedCriteria.graduationYear = false;
  }

  const studentBacklogs = Number(student.backlogs?.count);
  if (!Number.isFinite(studentBacklogs) && job.maxBacklogs !== undefined && job.maxBacklogs !== null) {
    reasons.push('Your backlog information is missing or invalid.');
    matchedCriteria.backlogs = false;
  } else if (job.maxBacklogs !== undefined && job.maxBacklogs !== null && studentBacklogs > Number(job.maxBacklogs)) {
    reasons.push(`Maximum allowed backlogs are ${job.maxBacklogs}, but you have ${studentBacklogs}.`);
    matchedCriteria.backlogs = false;
  }

  const requiredSemester = job.targetSemester ?? (Array.isArray(job.allowedSemesters) ? null : null);
  const studentSemester = Number(student.currentSemester);
  if (requiredSemester && (!Number.isFinite(studentSemester) || studentSemester !== Number(requiredSemester))) {
    reasons.push(`The required semester is Sem ${requiredSemester}, but your current semester is Sem ${student.currentSemester}.`);
    matchedCriteria.semester = false;
  } else if (Array.isArray(job.allowedSemesters) && job.allowedSemesters.length && !job.allowedSemesters.includes(Number(student.currentSemester))) {
    reasons.push('Your current semester is not eligible for this drive.');
    matchedCriteria.semester = false;
  }

  return { eligible: reasons.length === 0, passed: reasons.length === 0, reasons, matchedCriteria };
};

module.exports = { checkEligibility };
