const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');
const { initializeFirebaseAdmin } = require('../utils/firebaseAdmin');

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
    authProviders: ['local'],
    primaryAuthProvider: 'local',
    lastLoginAt: new Date(),
  });

  return buildAuthResponse(user);
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

module.exports = {
  signup,
  signin,
  firebaseLogin,
  getProfile,
};