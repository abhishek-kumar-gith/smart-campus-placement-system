const SKILLS = {
  javascript: ['javascript', 'js'], react: ['react', 'reactjs'], nodejs: ['node.js', 'nodejs', 'node'],
  express: ['express', 'express.js'], mongodb: ['mongodb', 'mongo db'], sql: ['sql'], python: ['python'],
  java: ['java'], docker: ['docker'], git: ['git'], typescript: ['typescript', 'ts'],
  'machine learning': ['machine learning', 'ml'], aws: ['aws'], azure: ['azure'],
};

const extractSkills = (text = '') => {
  const normalized = text.toLowerCase();
  return Object.entries(SKILLS).filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias))).map(([skill]) => skill);
};

module.exports = { extractSkills };
