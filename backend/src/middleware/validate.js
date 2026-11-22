const ApiResponse = require('../utils/apiResponse');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    return ApiResponse.error(res, 'Validation failed', 422, errors);
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    return ApiResponse.error(res, 'Invalid query parameters', 422, errors);
  }
  req.query = result.data;
  next();
};

module.exports = { validate, validateQuery };
