const normalize = (value) => String(value || '').trim().toLowerCase();

const calculateSkillMatch = (studentSkills = [], requiredSkills = []) => {
  const studentSet = new Set(studentSkills.map(normalize).filter(Boolean));
  const required = [...new Set(requiredSkills.map(normalize).filter(Boolean))];
  const matchedSkills = required.filter((skill) => studentSet.has(skill));
  const missingSkills = required.filter((skill) => !studentSet.has(skill));
  return {
    matchedSkills,
    missingSkills,
    score: required.length ? Math.round((matchedSkills.length / required.length) * 100) : 100,
  };
};

module.exports = { calculateSkillMatch };
