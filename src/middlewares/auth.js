const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const User = require('../models/user.model');

function resolveToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header === 'string' && header.trim()) {
    const normalized = header.trim();
    if (normalized.startsWith('Bearer ')) {
      return normalized.slice(7).trim();
    }
    return normalized;
  }

  const altHeader = req.headers?.['x-auth-token'] || req.headers?.['x-access-token'];
  if (typeof altHeader === 'string' && altHeader.trim()) {
    const normalized = altHeader.trim();
    return normalized.startsWith('Bearer ') ? normalized.slice(7).trim() : normalized;
  }

  const queryToken = req.query?.token || req.query?.access_token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    const normalized = queryToken.trim();
    return normalized.startsWith('Bearer ') ? normalized.slice(7).trim() : normalized;
  }

  if (req.cookies?.token && typeof req.cookies.token === 'string') {
    return req.cookies.token.trim();
  }

  return null;
}

async function authMiddleware(req, _res, next) {
  const token = resolveToken(req);

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError('Invalid or expired token', 401));
  }
}

authMiddleware.resolveToken = resolveToken;
module.exports = authMiddleware;
