const express = require("express");

const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/auth");
const srsRequestController = require("../controllers/srsRequest.controller");
const notificationController = require('../controllers/notification.controller');
const adminMiddleware = require('../middlewares/admin');

const router = express.Router();

// Authentication
router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.post("/firebase", authController.firebaseLogin);

// Email Verification
router.post("/request-otp", authController.requestOtp);
router.post("/verify-otp", authController.verifyOtp);

// Profile
router.get("/profile", authenticate, authController.profile);
router.post("/profile", authenticate, authController.updateProfile);

// SRS
router.post(
  "/srs-requests",
  authenticate,
  srsRequestController.createSrsRequest
);
router.get('/srs-requests/status', authenticate, srsRequestController.getStatus);
router.patch('/admin/srs-requests/:id', authenticate, adminMiddleware, srsRequestController.review);

router.get('/notifications', authenticate, notificationController.list);
router.patch('/notifications/read-all', authenticate, notificationController.markAllRead);

// Password Reset
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
