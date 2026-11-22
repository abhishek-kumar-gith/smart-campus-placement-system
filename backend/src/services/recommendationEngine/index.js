const { checkEligibility } = require('../eligibilityEngine');
const { calculateSkillMatch } = require('../skillMatching');

const rankJobsForStudent = (student, jobs) => jobs
  .map((job) => {
    const eligibility = checkEligibility(student, job);
    const match = calculateSkillMatch(student.skills, job.requiredSkills);
    return { job, eligibility, ...match };
  })
  .filter((item) => item.eligibility.passed)
  .sort((a, b) => b.score - a.score);

module.exports = { rankJobsForStudent };
