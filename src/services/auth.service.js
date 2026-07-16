const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');
const { initializeFirebaseAdmin } = require('../utils/firebaseAdmin');
const { generateOtp } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/resend');

const OTP_EXPIRY_MINUTES = 10;

function buildAuthResponse(user) {
  const safeUser = typeof user.toSafeObject === 'function' ? user.toSafeObject() : user;

  return {
    token: signToken({ sub: String(user._id), email: user.email }),
    user: safeUser,
  };
}

async function signup({ name, email, password, photoURL }) {
  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    photoURL: photoURL || null,
    emailVerified: false,
    authProviders: ['local'],
    primaryAuthProvider: 'local',
    lastLoginAt: new Date(),
  });

  const otpResult = await sendVerificationOtp(user);

  return {
    message: 'Signup successful. OTP sent to registered email address.',
    otpSent: true,
    otpExpiresAt: otpResult.otpExpiresAt,
    user: user.toSafeObject(),
  };
}

async function signin({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
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
  if (!idToken) {
    throw new AppError('Firebase idToken is required', 400);
  }

  try {
    const admin = initializeFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const provider = decodedToken.firebase?.sign_in_provider || 'firebase';
    const email = decodedToken.email ? decodedToken.email.toLowerCase() : null;

    if (!email) {
      throw new AppError('Firebase account must have an email', 400);
    }

    let user = await User.findOne({
      $or: [{ firebaseUid: decodedToken.uid }, { email }],
    }).select('+passwordHash');

    if (!user) {
      user = await User.create({
        name: decodedToken.name || decodedToken.email.split('@')[0],
        email,
        photoURL: decodedToken.picture || null,
        firebaseUid: decodedToken.uid,
        emailVerified: true,
        authProviders: [provider],
        primaryAuthProvider: 'firebase',
        lastLoginAt: new Date(),
      });
    } else {
      const providers = new Set(user.authProviders || []);
      providers.add(provider);

      user.name = decodedToken.name || user.name;
      user.photoURL = decodedToken.picture || user.photoURL;
      user.firebaseUid = decodedToken.uid;
      user.emailVerified = true;
      user.authProviders = Array.from(providers);
      user.primaryAuthProvider = 'firebase';
      user.lastLoginAt = new Date();
      await user.save();
    }

    const freshUser = await User.findById(user._id);
    return buildAuthResponse(freshUser);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Firebase login failed', 401);
  }
}

async function getProfile(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user.toSafeObject();
}

async function sendVerificationOtp(userOrEmail) {
  const email = typeof userOrEmail === 'string' ? userOrEmail.trim().toLowerCase() : userOrEmail.email;
  const user = typeof userOrEmail === 'string' ? await User.findOne({ email }).select('+emailOtpHash') : userOrEmail;

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const otp = generateOtp(6);
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  user.emailOtpHash = otpHash;
  user.emailOtpExpiresAt = otpExpiresAt;
  user.emailOtpRequestedAt = new Date();
  await user.save();

  try {
    await sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });
  } catch (error) {
    throw new AppError(`OTP email failed: ${error.message}`, 502);
  }

  return { otpExpiresAt };
}

async function verifyEmailOtp({ email, otp }) {
  if (!email || !otp) {
    throw new AppError('Email and OTP are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+emailOtpHash +passwordHash');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    return {
      message: 'Email already verified',
      user: user.toSafeObject(),
    };
  }

  if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
    throw new AppError('OTP not requested', 400);
  }

  if (user.emailOtpExpiresAt.getTime() < Date.now()) {
    throw new AppError('OTP expired. Please request a new one.', 400);
  }

  const isValidOtp = await bcrypt.compare(String(otp).trim(), user.emailOtpHash);
  if (!isValidOtp) {
    throw new AppError('Invalid OTP', 401);
  }

  user.emailVerified = true;
  user.emailOtpHash = null;
  user.emailOtpExpiresAt = null;
  user.emailOtpRequestedAt = null;
  await user.save();

  const freshUser = await User.findById(user._id);

  return {
    message: 'Email verified successfully',
    ...buildAuthResponse(freshUser),
  };
}

async function requestEmailOtp({ email }) {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    return {
      message: 'Email already verified',
      otpSent: false,
      user: user.toSafeObject(),
    };
  }

  const otpResult = await sendVerificationOtp(user);

  return {
    message: 'OTP sent to registered email address',
    otpSent: true,
    otpExpiresAt: otpResult.otpExpiresAt,
  };
}

module.exports = {
  signup,
  signin,
  firebaseLogin,
  getProfile,
  requestEmailOtp,
  verifyEmailOtp,
};