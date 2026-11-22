const { verifyAccessToken } = require('../utils/generateToken');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  if (!token) return ApiResponse.error(res, 'Access denied. No token provided.', 401);
  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded.id).select('-passwordHash');
  if (!user) return ApiResponse.error(res, 'User no longer exists.', 401);
  if (!user.isActive) return ApiResponse.error(res, 'Your account has been deactivated.', 403);
  req.user = user;
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return ApiResponse.error(res, `Access denied. Required role(s): ${roles.join(', ')}.`, 403);
  }
  next();
};

const optionalProtect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  if (!token) return next();
  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (user?.isActive) req.user = user;
  } catch (error) {
    req.user = undefined;
  }
  next();
});

module.exports = { protect, authorize, optionalProtect };
