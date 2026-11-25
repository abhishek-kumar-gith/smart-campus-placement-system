const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const {
  getPublicPlacementSummary,
  getPublicPlacements,
  getPlacements,
  finalizePlacement,
} = require('../controllers/placement.controller');

router.get('/public/summary', asyncHandler(getPublicPlacementSummary));
router.get('/public', asyncHandler(getPublicPlacements));
router.get('/', protect, asyncHandler(getPlacements));
router.post('/finalize', protect, authorize('admin'), validate(z.object({
  applicationId: z.string(),
  package: z.coerce.number().min(0).optional(),
  monthlyStipend: z.coerce.number().min(0).optional(),
  jobLocation: z.string().trim().optional(),
  jobRole: z.string().trim().optional(),
  offerDate: z.coerce.date().optional(),
  joiningDate: z.coerce.date().optional(),
  placementDetails: z.string().trim().max(1000).optional(),
})), asyncHandler(finalizePlacement));
module.exports = router;
