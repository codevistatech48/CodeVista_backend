const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");

// ==========================
// Signup
// ==========================
const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);

  res.status(201).json({
    success: true,
    ...result,
  });
});

// ==========================
// Signin
// ==========================
const signin = asyncHandler(async (req, res) => {
  const result = await authService.signin(req.body);

  res.status(200).json({
    success: true,
    ...result,
  });
});

// ==========================
// Google / GitHub Login
// ==========================
const firebaseLogin = asyncHandler(async (req, res) => {
  const result = await authService.firebaseLogin(req.body);

  res.status(200).json({
    success: true,
    ...result,
  });
});

// ==========================
// Request OTP
// ==========================
const requestOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestEmailOtp(req.body);

  res.status(200).json({
    success: true,
    ...result,
  });
});

// ==========================
// Verify OTP
// ==========================
const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailOtp(req.body);

  res.status(200).json({
    success: true,
    ...result,
  });
});

// ==========================
// Get Profile
// ==========================
const profile = asyncHandler(async (req, res) => {
  const profileData = await authService.getProfile(req.user._id);

  res.status(200).json({
    success: true,
    user: profileData,
  });
});

// ==========================
// Update Profile
// ==========================
const updateProfile = asyncHandler(async (req, res) => {
  const updatedUser = await authService.updateProfile(
    req.user._id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    user: updatedUser,
  });
});

// ==========================
// Forgot Password - Request reset link
// ==========================
const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  console.log("Forgot Password Result:", result);

  res.status(200).json({
    success: true,
    ...result,
  });
});

// ==========================
// Reset Password - Use token to set new password
// ==========================
const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);

  res.status(200).json({
    success: true,
    ...result,
  });
});

module.exports = {
  signup,
  signin,
  firebaseLogin,
  requestOtp,
  verifyOtp,
  profile,
  updateProfile,
  forgotPassword,
  resetPassword,
};
