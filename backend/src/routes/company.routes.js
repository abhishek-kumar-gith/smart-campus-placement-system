const router = require('express').Router();
const { z } = require('zod');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const {
  getActiveCompanies,
  createCompany,
  updateCompany,
} = require('../controllers/company.controller');

router.get('/', asyncHandler(getActiveCompanies));
router.post('/', protect, authorize('admin'), validate(z.object({
  name: z.string().trim().min(1),
  logo: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().trim().min(1),
  location: z.string().trim().min(1),
  description: z.string().optional(),
  hrName: z.string().trim().min(1),
  hrEmail: z.string().email(),
  contactNumber: z.string().trim().min(1),
}).strict()), asyncHandler(createCompany));
router.patch('/:id', protect, authorize('admin'), validate(z.object({
  name: z.string().trim().min(1).optional(),
  logo: z.string().nullable().optional(),
  website: z.string().optional(),
  industry: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  hrName: z.string().trim().min(1).optional(),
  hrEmail: z.string().email().optional(),
  contactNumber: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  remarks: z.string().trim().max(1000).optional(),
}).strict()), asyncHandler(updateCompany));

module.exports = router;
