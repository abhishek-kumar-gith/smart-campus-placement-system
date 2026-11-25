const router = require('express').Router();
const { z } = require('zod');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  getOffers,
  createOffer,
  updateOfferStatus,
  downloadOfferPdf,
} = require('../controllers/offerLetter.controller');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid object ID.');
const createOfferSchema = z.object({
  applicationId: objectId,
  annualCtc: z.coerce.number().min(0),
  monthlyStipend: z.coerce.number().min(0).optional(),
  designation: z.string().trim().min(2).max(200).optional(),
  jobLocation: z.string().trim().max(300).optional(),
  joiningDate: z.coerce.date().optional(),
  employmentType: z.enum(['Full-time', 'Internship', 'Contract']).optional(),
  reportingDetails: z.string().trim().max(2000).optional(),
  termsAndConditions: z.string().trim().max(10000).optional(),
  authorizedSignatory: z.string().trim().max(200).optional(),
}).strict();

router.use(protect);
router.get('/', authorize('student', 'recruiter', 'admin'), asyncHandler(getOffers));
router.get('/:id/pdf', authorize('student', 'recruiter', 'admin'), asyncHandler(downloadOfferPdf));
router.post('/', authorize('recruiter', 'admin'), validate(createOfferSchema), asyncHandler(createOffer));
router.patch('/:id/status', authorize('student', 'recruiter', 'admin'), validate(z.object({
  status: z.enum(['issued', 'accepted', 'rejected', 'expired', 'revoked']),
  remarks: z.string().trim().max(1000).optional(),
}).strict()), asyncHandler(updateOfferStatus));

module.exports = router;
