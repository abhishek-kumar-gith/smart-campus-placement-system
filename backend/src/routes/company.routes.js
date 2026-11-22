const router = require('express').Router();
const Company = require('../models/Company.model');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

router.get('/', asyncHandler(async (req, res) => ApiResponse.success(res, await Company.find({ status: 'active' }).sort({ name: 1 }))));
router.post('/', protect, authorize('admin'), asyncHandler(async (req, res) => ApiResponse.success(res, await Company.create({ ...req.body, addedBy: req.user._id, status: 'active' }), 'Company created', 201)));
router.patch('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => ApiResponse.success(res, await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }), 'Company updated')));

module.exports = router;
