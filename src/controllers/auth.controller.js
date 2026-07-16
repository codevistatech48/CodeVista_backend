const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);
  res.status(201).json({ success: true, ...result });
});

const signin = asyncHandler(async (req, res) => {
  const result = await authService.signin(req.body);
  res.status(200).json({ success: true, ...result });
});

const firebaseLogin = asyncHandler(async (req, res) => {
  const result = await authService.firebaseLogin(req.body);
  res.status(200).json({ success: true, ...result });
});

const requestOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestEmailOtp(req.body);
  res.status(200).json({ success: true, ...result });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailOtp(req.body);
  res.status(200).json({ success: true, ...result });
});

const profile = asyncHandler(async (req, res) => {
  const profileData = await authService.getProfile(req.user._id);
  res.status(200).json({ success: true, user: profileData });
});

module.exports = {
  signup,
  signin,
  firebaseLogin,
  requestOtp,
  verifyOtp,
  profile,
};