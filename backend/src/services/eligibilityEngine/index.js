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
  if (requiredCgpa > 0 && studentCgpa < requiredCgpa) {
    reasons.push(`Minimum required CGPA is ${requiredCgpa}, but your CGPA is ${studentCgpa}.`);
    matchedCriteria.cgpa = false;
  }

  if (!Array.isArray(job.allowedBranches) || job.allowedBranches.length === 0) {
    reasons.push('No eligible branches have been selected for this drive.');
    matchedCriteria.branch = false;
  } else if (!job.allowedBranches.includes(student.branch)) {
    reasons.push('Your branch is not eligible for this drive.');
    matchedCriteria.branch = false;
  }

  if (job.targetGraduationYear && Number(student.graduationYear) !== Number(job.targetGraduationYear)) {
    reasons.push(`The required graduation year is ${job.targetGraduationYear}, but your graduation year is ${student.graduationYear}.`);
    matchedCriteria.graduationYear = false;
  }

  const studentBacklogs = Number(student.backlogs?.count || 0);
  if (job.maxBacklogs !== undefined && job.maxBacklogs !== null && studentBacklogs > Number(job.maxBacklogs)) {
    reasons.push(`Maximum allowed backlogs are ${job.maxBacklogs}, but you have ${studentBacklogs}.`);
    matchedCriteria.backlogs = false;
  }

  const requiredSemester = job.targetSemester ?? (Array.isArray(job.allowedSemesters) ? null : null);
  if (requiredSemester && Number(student.currentSemester) !== Number(requiredSemester)) {
    reasons.push(`The required semester is Sem ${requiredSemester}, but your current semester is Sem ${student.currentSemester}.`);
    matchedCriteria.semester = false;
  } else if (Array.isArray(job.allowedSemesters) && job.allowedSemesters.length && !job.allowedSemesters.includes(Number(student.currentSemester))) {
    reasons.push('Your current semester is not eligible for this drive.');
    matchedCriteria.semester = false;
  }

  return { eligible: reasons.length === 0, passed: reasons.length === 0, reasons, matchedCriteria };
};

module.exports = { checkEligibility };
