const router = require('express').Router();
const { z } = require('zod');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { uploadProfilePhoto } = require('../middleware/upload');
const {
  getProfile,
  updateProfile,
  uploadProfilePhoto: uploadProfilePhotoHandler,
  getRecommendations,
  getApplications,
} = require('../controllers/student.controller');

const projectSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  technologies: z.array(z.string().trim().min(1).max(100)).optional(),
  link: z.string().max(1000).optional(),
  startDate: z.union([z.null(), z.coerce.date()]).optional(),
  endDate: z.union([z.null(), z.coerce.date()]).optional(),
}).strict();
const internshipSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  duration: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  startDate: z.union([z.null(), z.coerce.date()]).optional(),
  endDate: z.union([z.null(), z.coerce.date()]).optional(),
}).strict();
const certificationSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  name: z.string().trim().min(1).max(200),
  issuer: z.string().max(200).optional(),
  issueDate: z.union([z.null(), z.coerce.date()]).optional(),
  credentialId: z.string().max(200).optional(),
  credentialUrl: z.string().max(1000).optional(),
}).strict();
const profileSchema = z.object({
  fullName: z.string().min(2).optional(), phone: z.string().min(7).optional(), branch: z.string().optional(), degree: z.string().optional(),
  currentSemester: z.coerce.number().int().min(1).max(8).optional(), cgpa: z.coerce.number().min(0).max(10).optional(),
  graduationYear: z.coerce.number().int().optional(), backlogs: z.object({ count: z.coerce.number().int().min(0), details: z.string().optional() }).optional(),
  skills: z.array(z.string().min(1)).optional(),
  projects: z.array(projectSchema).max(100).optional(),
  internships: z.array(internshipSchema).max(100).optional(),
  certifications: z.array(certificationSchema).max(100).optional(),
}).strict();

router.use(protect, authorize('student'));
router.get('/profile', asyncHandler(getProfile));
router.patch('/profile', validate(profileSchema), asyncHandler(updateProfile));
router.post('/profile/photo', uploadProfilePhoto.single('photo'), asyncHandler(uploadProfilePhotoHandler));
router.get('/recommendations', asyncHandler(getRecommendations));
router.get('/applications', asyncHandler(getApplications));

module.exports = router;
