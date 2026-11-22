const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/resumes');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uid = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `resume-${req.user ? req.user.id : 'anon'}-${uid}.pdf`);
  },
});

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uid = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `logo-${uid}${path.extname(file.originalname)}`);
  },
});

const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/profile-photos');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uid = `${req.user ? req.user.id : 'anon'}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile-${uid}${ext}`);
  },
});

const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(Object.assign(new Error('Only PDF files are allowed for resumes.'), { code: 'LIMIT_UNEXPECTED_FILE' }));
};

const imageFilter = (req, file, cb) => {
  if (/^image\/(jpeg|jpg|pjpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(Object.assign(new Error('Only JPEG, PNG, or WebP images are allowed.'), { code: 'LIMIT_UNEXPECTED_FILE' }));
};

const maxSize = env.MAX_FILE_SIZE_MB * 1024 * 1024;

const uploadResume = multer({ storage: resumeStorage, fileFilter: pdfFilter, limits: { fileSize: maxSize } });
const uploadLogo = multer({ storage: logoStorage, fileFilter: imageFilter, limits: { fileSize: maxSize } });
const uploadProfilePhoto = multer({ storage: profilePhotoStorage, fileFilter: imageFilter, limits: { fileSize: maxSize } });

module.exports = { uploadResume, uploadLogo, uploadProfilePhoto };
