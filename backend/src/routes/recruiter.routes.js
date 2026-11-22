const router = require('express').Router();
const Recruiter = require('../models/Recruiter.model');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

router.get('/profile', protect, authorize('recruiter'), asyncHandler(async (req, res) => ApiResponse.success(res, await Recruiter.findOne({ userId: req.user._id }).populate('companyId'))));
router.get('/', protect, authorize('admin'), asyncHandler(async (req, res) => ApiResponse.success(res, await Recruiter.find().populate('companyId').sort({ createdAt: -1 }))));
router.patch('/:id/approval', protect, authorize('admin'), asyncHandler(async (req, res) => ApiResponse.success(res, await Recruiter.findByIdAndUpdate(req.params.id, { approvalStatus: req.body.approvalStatus, approvedBy: req.user._id, approvedAt: new Date() }, { new: true }), 'Recruiter approval updated')));

module.exports = router;
