const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 1000,
  message: { success: false, message: 'Too many requests. Try again after 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5000,
  message: { success: false, message: 'Too many requests. Try again after 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };
