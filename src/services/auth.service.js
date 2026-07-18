const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const PendingSignup = require('../models/pendingSignup.model');
const AppError = require('../utils/AppError');
const {
  signToken
} = require('../utils/jwt');
const {
  initializeFirebaseAdmin
} = require('../utils/firebaseAdmin');
const {
  generateOtp
} = require('../utils/otp');
const {
  sendOtpEmail,
  sendPasswordResetEmail
} = require('../utils/resend');
const { notifyAdmins } = require('./notification.service');

const OTP_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

function buildAuthResponse(user, oauthProvider) {
  const safeUser = typeof user.toSafeObject === 'function' ? user.toSafeObject() : user;

  return {
    token: signToken({
      sub: String(user._id),
      email: user.email
    }),
    user: oauthProvider ? {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.photoURL || null,
      authProvider: oauthProvider,
    } : safeUser,
  };
}

async function signup({
  name,
  email,
  password,
  photoURL
}) {
  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({
    email: normalizedEmail
  });
  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let pendingSignup = await PendingSignup.findOne({
    email: normalizedEmail
  });

  if (!pendingSignup) {
    pendingSignup = await PendingSignup.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      photoURL: photoURL || null,
    });
  } else {
    pendingSignup.name = name.trim();
    pendingSignup.passwordHash = passwordHash;
    pendingSignup.photoURL = photoURL || null;
    await pendingSignup.save();
  }

  const otpResult = await sendVerificationOtp(pendingSignup);

  return {
    message: 'Signup initiated. OTP sent to registered email address.',
    otpSent: true,
    otpExpiresAt: otpResult.otpExpiresAt,
    email: normalizedEmail,
  };
}

async function signin({
  email,
  password
}) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail
  }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    throw new AppError('Invalid credentials', 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.emailVerified) {
    throw new AppError('Email is not verified. Please verify the OTP sent to your email.', 403);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const freshUser = await User.findById(user._id);
  return buildAuthResponse(freshUser);
}

async function firebaseLogin({ idToken }) {
  if (!idToken || !idToken.trim()) {
    throw new AppError("Firebase idToken is required", 400);
  }

  let admin;
  let decodedToken;

  try {
    admin = initializeFirebaseAdmin();

    decodedToken = await admin
      .auth()
      .verifyIdToken(idToken.trim());
  } catch (error) {
    console.error("Firebase Verify Error:", error);

    throw new AppError(
      "Invalid Firebase ID token",
      401
    );
  }

  const provider =
    decodedToken.firebase?.sign_in_provider;

  if (!["google.com", "github.com"].includes(provider)) {
    throw new AppError(
      "Unsupported OAuth provider",
      400
    );
  }

  const email = decodedToken.email
    ?.trim()
    .toLowerCase();

  if (!email) {
    throw new AppError(
      "Email not found in Firebase token",
      400
    );
  }

  try {
    const firebaseUser =
      await admin.auth().getUser(decodedToken.uid);

    if (firebaseUser.disabled) {
      throw new AppError(
        "Firebase account is disabled",
        403
      );
    }

    let user =
      (await User.findOne({
        firebaseUid: decodedToken.uid,
      })) ||
      (await User.findOne({
        email,
      }));

    const isNewUser = !user;
    if (!user) {
      user = await User.create({
        name:
          firebaseUser.displayName ||
          decodedToken.name ||
          email.split("@")[0],

        email,

        firebaseUid: decodedToken.uid,

        photoURL:
          firebaseUser.photoURL ||
          decodedToken.picture ||
          null,

        emailVerified:
          firebaseUser.emailVerified,

        authProvider: provider,

        authProviders: [provider],

        primaryAuthProvider: provider,

        lastLoginAt: new Date(),
      });
    } else {
      user.name =
        firebaseUser.displayName ||
        decodedToken.name ||
        user.name;

      user.photoURL =
        firebaseUser.photoURL ||
        decodedToken.picture ||
        user.photoURL;

      if (!user.firebaseUid) {
        user.firebaseUid = decodedToken.uid;
      }

      user.authProvider = provider;

      user.authProviders = Array.from(
        new Set([
          ...(user.authProviders || []),
          provider,
        ])
      );

      user.primaryAuthProvider = provider;

      user.emailVerified =
        firebaseUser.emailVerified;

      user.lastLoginAt = new Date();

      await user.save();
    }

    if (isNewUser) {
      await notifyAdmins({ title: 'New user registered', message: `${user.name} created an account.`, type: 'admin_new_user' }).catch(() => {});
    }

    return buildAuthResponse(user, provider);
  } catch (error) {
    console.error(error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Unable to complete OAuth login",
      500
    );
  }
}

async function getProfile(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user.toSafeObject();
}

async function updateProfile(userId, data) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.name = data.name?.trim() ?? user.name;

  if (data.company !== undefined)
    user.company = data.company?.trim() || "";

  if (data.location !== undefined)
    user.location = data.location?.trim() || "";

  if (data.bio !== undefined)
    user.bio = data.bio?.trim() || "";

  if (data.github !== undefined)
    user.github = data.github?.trim() || "";

  if (data.linkedin !== undefined)
    user.linkedin = data.linkedin?.trim() || "";

  if (data.website !== undefined)
    user.website = data.website?.trim() || "";

  await user.save();

  return user.toSafeObject();
}

async function sendVerificationOtp(userOrEmail) {
  const email = typeof userOrEmail === 'string' ? userOrEmail.trim().toLowerCase() : userOrEmail.email;
  const pendingSignup =
    typeof userOrEmail === 'string' ?
    await PendingSignup.findOne({
      email
    }).select('+otpHash +passwordHash') :
    userOrEmail;

  if (!pendingSignup) {
    throw new AppError('No pending signup found for this email', 404);
  }

  const otp = generateOtp(6);
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  pendingSignup.otpHash = otpHash;
  pendingSignup.otpExpiresAt = otpExpiresAt;
  pendingSignup.otpRequestedAt = new Date();
  await pendingSignup.save();

  try {
    await sendOtpEmail({
      to: pendingSignup.email,
      name: pendingSignup.name,
      otp,
    });
  } catch (error) {
    throw new AppError(`OTP email failed: ${error.message}`, 502);
  }

  return {
    otpExpiresAt
  };
}

async function verifyEmailOtp({
  email,
  otp
}) {
  if (!email || !otp) {
    throw new AppError('Email and OTP are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({
    email: normalizedEmail
  });

  if (existingUser) {
    return {
      message: 'Email already verified',
      ...buildAuthResponse(existingUser),
    };
  }

  const pendingSignup = await PendingSignup.findOne({
    email: normalizedEmail
  }).select('+otpHash +passwordHash');

  if (!pendingSignup) {
    throw new AppError('No pending signup found for this email', 404);
  }

  if (!pendingSignup.otpHash || !pendingSignup.otpExpiresAt) {
    throw new AppError('OTP not requested', 400);
  }

  if (pendingSignup.otpExpiresAt.getTime() < Date.now()) {
    throw new AppError('OTP expired. Please request a new one.', 400);
  }

  const isValidOtp = await bcrypt.compare(String(otp).trim(), pendingSignup.otpHash);
  if (!isValidOtp) {
    throw new AppError('Invalid OTP', 401);
  }

  const freshUser = await User.create({
    name: pendingSignup.name,
    email: pendingSignup.email,
    passwordHash: pendingSignup.passwordHash,
    photoURL: pendingSignup.photoURL || null,
    emailVerified: true,
    authProviders: ['local'],
    primaryAuthProvider: 'local',
    lastLoginAt: new Date(),
  });

  await notifyAdmins({ title: 'New user registered', message: `${freshUser.name} created an account.`, type: 'admin_new_user' }).catch(() => {});

  await PendingSignup.deleteOne({
    _id: pendingSignup._id
  });

  return {
    message: 'Email verified successfully',
    ...buildAuthResponse(freshUser),
  };
}

async function requestEmailOtp({
  email
}) {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail
  });

  if (user) {
    return {
      message: 'User already registered',
      otpSent: false,
      user: user.toSafeObject(),
    };
  }

  const pendingSignup = await PendingSignup.findOne({
    email: normalizedEmail
  });

  if (!pendingSignup) {
    throw new AppError('No pending signup found for this email', 404);
  }

  const otpResult = await sendVerificationOtp(pendingSignup);

  return {
    message: 'OTP sent to pending signup email address',
    otpSent: true,
    otpExpiresAt: otpResult.otpExpiresAt,
  };
}

// ==========================
// Forgot Password
// ==========================
async function forgotPassword({ email, resetUrl }) {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });

  // Don't reveal whether the account exists
  if (!user) {
    return {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  }

  // Allow only local login users
  if (user.primaryAuthProvider !== "local") {
    return {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  }

  // Generate secure token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = await bcrypt.hash(resetToken, 10);

  const resetExpires = new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000
  );

  user.passwordResetToken = resetTokenHash;
  user.passwordResetExpires = resetExpires;
  await user.save();

  // ----------------------------
  // Build Reset URL Safely
  // ----------------------------

  const clientUrl =
    process.env.CLIENT_URL || "http://localhost:5173";

  const baseUrl =
    resetUrl || `${clientUrl.replace(/\/$/, "")}/reset-password`;

  const url = new URL(baseUrl);

  url.searchParams.set("token", resetToken);
  url.searchParams.set("email", normalizedEmail);

  const resetLink = url.toString();

  console.log("Generated Reset Link:", resetLink);

  try {
    const response = await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      resetLink,
    });

    console.log("Resend Response:", response);

    return {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  } catch (error) {
    console.error("Resend Error:", error);

    // Remove token if email sending failed
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    throw new AppError(
      "Failed to send password reset email. Please try again later.",
      502
    );
  }
}

// ==========================
// Reset Password
// ==========================
async function resetPassword({ email, token, newPassword, password }) {
  // Support both newPassword and password field names from frontend
  const finalPassword = newPassword || password;

  if (!email || !token || !finalPassword) {
    throw new AppError('Email, token, and new password are required', 400);
  }

  if (finalPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordResetToken +passwordResetExpires +passwordHash');
  if (!user) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  if (!user.passwordResetToken || !user.passwordResetExpires) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  if (user.passwordResetExpires.getTime() < Date.now()) {
    // Clear expired token
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    throw new AppError('Reset token has expired. Please request a new one.', 400);
  }

  const isValidToken = await bcrypt.compare(token, user.passwordResetToken);
  if (!isValidToken) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Hash new password and update
  const passwordHash = await bcrypt.hash(finalPassword, 12);
  user.passwordHash = passwordHash;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  return {
    message: 'Password has been reset successfully. You can now log in with your new password.',
  };
}

module.exports = {
  signup,
  signin,
  firebaseLogin,
  getProfile,
  updateProfile,
  requestEmailOtp,
  verifyEmailOtp,
  forgotPassword,
  resetPassword,
};