const rateLimit = require('express-rate-limit');
const env = require('../config/env');

module.exports = rateLimit({
  windowMs: env.adminRateLimitWindowMs,
  limit: env.adminRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin requests. Please try again later.', errors: [] },
});
