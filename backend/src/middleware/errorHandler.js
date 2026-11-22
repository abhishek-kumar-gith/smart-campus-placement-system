const logger = require('../utils/logger');
const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  if (err.name === 'CastError') { statusCode = 400; message = `Invalid ${err.path}: ${err.value}`; }
  if (err.name === 'ValidationError') {
    statusCode = 400; message = 'Validation Error';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists.`;
  }
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token.'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired. Please log in again.'; }
  if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 400; message = `File too large. Max ${env.MAX_FILE_SIZE_MB}MB.`; }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') { statusCode = 400; message = err.message || 'Unexpected file field.'; }

  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  const response = { success: false, message };
  if (errors) response.errors = errors;
  if (env.NODE_ENV !== 'production' && err.stack) response.stack = err.stack;

  return res.status(statusCode).json(response);
};

module.exports = errorHandler;
