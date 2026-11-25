const Company = require('../models/Company.model');
const ApiResponse = require('../utils/apiResponse');

const getActiveCompanies = async (req, res) => {
  return ApiResponse.success(
    res,
    await Company.find({ status: 'active' }).sort({ name: 1 }),
  );
};

const createCompany = async (req, res) => {
  return ApiResponse.success(
    res,
    await Company.create({ ...req.body, addedBy: req.user._id, status: 'active' }),
    'Company created',
    201,
  );
};

const updateCompany = async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) return ApiResponse.error(res, 'Company not found.', 404);
  const previousStatus = company.status;
  if (
    req.body.status
    && req.body.status !== previousStatus
  ) {
    const allowedTransitions = {
      pending: ['active', 'inactive'],
      active: ['inactive'],
      inactive: ['active', 'pending'],
    };
    if (!allowedTransitions[previousStatus]?.includes(req.body.status)) {
      return ApiResponse.error(res, 'Invalid company status transition.', 409);
    }
  }
  const remarks = req.body.remarks || '';
  delete req.body.remarks;
  Object.assign(company, req.body);
  if (req.body.status && req.body.status !== previousStatus) {
    const action = req.body.status === 'active'
      ? 'approved'
      : req.body.status === 'pending'
        ? 'pending'
        : 'rejected';
    company.approvalHistory.push({
      previousStatus,
      newStatus: req.body.status,
      action,
      changedBy: req.user._id,
      changedByRole: req.user.role,
      remarks,
    });
  }
  await company.save();
  return ApiResponse.success(res, company, 'Company updated');
};

module.exports = {
  getActiveCompanies,
  createCompany,
  updateCompany,
};
