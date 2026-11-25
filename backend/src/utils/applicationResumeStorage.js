const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const defaultResumeRoot = path.join(__dirname, '../../uploads/resumes');
const defaultApplicationResumeRoot = path.join(__dirname, '../../uploads/application-resumes');
const storedFilePattern = /^application-resume-[a-f0-9-]+\.pdf$/i;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const copyApplicationResume = (resume, options = {}) => {
  const resumeRoot = options.resumeRoot || defaultResumeRoot;
  const applicationResumeRoot =
    options.applicationResumeRoot || defaultApplicationResumeRoot;

  if (!resume?.fileUrl) {
    const error = new Error('Your resume is missing. Please upload a resume before applying.');
    error.statusCode = 404;
    throw error;
  }

  const sourceFileName = path.basename(resume.fileUrl);
  if (!sourceFileName || sourceFileName.includes('..')) {
    const error = new Error('Your resume file reference is invalid.');
    error.statusCode = 400;
    throw error;
  }

  const sourcePath = path.resolve(resumeRoot, sourceFileName);
  const resolvedResumeRoot = path.resolve(resumeRoot);
  if (
    path.dirname(sourcePath) !== resolvedResumeRoot
    || !fs.existsSync(sourcePath)
  ) {
    const error = new Error('Your resume file is missing. Please upload your resume again.');
    error.statusCode = 404;
    throw error;
  }

  ensureDir(applicationResumeRoot);
  const storedFileName =
    `application-resume-${crypto.randomUUID()}.pdf`;
  const destinationPath = path.resolve(applicationResumeRoot, storedFileName);

  fs.copyFileSync(sourcePath, destinationPath);
  return {
    storedFileName,
    storedFilePath: destinationPath,
    fileSize: fs.statSync(destinationPath).size,
  };
};

const removeApplicationResume = (storedFileName, options = {}) => {
  if (!storedFilePattern.test(storedFileName || '')) return false;
  const applicationResumeRoot =
    options.applicationResumeRoot || defaultApplicationResumeRoot;
  const filePath = path.resolve(applicationResumeRoot, storedFileName);
  if (path.dirname(filePath) !== path.resolve(applicationResumeRoot)) return false;
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
};

const resolveApplicationResumePath = (storedFileName, options = {}) => {
  if (!storedFilePattern.test(storedFileName || '')) return null;
  const applicationResumeRoot =
    options.applicationResumeRoot || defaultApplicationResumeRoot;
  const filePath = path.resolve(applicationResumeRoot, storedFileName);
  if (path.dirname(filePath) !== path.resolve(applicationResumeRoot)) return null;
  if (!fs.existsSync(filePath)) return null;
  return filePath;
};

module.exports = {
  copyApplicationResume,
  removeApplicationResume,
  resolveApplicationResumePath,
};
