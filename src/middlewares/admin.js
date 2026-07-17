const AppError = require('../utils/AppError');

function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) return next(new AppError('Admin access required', 403));
    next();
  };
}

const adminMiddleware = authorize('admin');
module.exports = adminMiddleware;
module.exports.authorize = authorize;
