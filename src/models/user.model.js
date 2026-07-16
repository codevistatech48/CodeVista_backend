const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    emailOtpExpiresAt: {
      type: Date,
      default: null,
    },
    emailOtpRequestedAt: {
      type: Date,
      default: null,
    },
    photoURL: {
      type: String,
      default: null,
    },
    firebaseUid: {
      type: String,
      default: null,
      index: true,
    },
    authProviders: {
      type: [String],
      default: ['local'],
    },
    primaryAuthProvider: {
      type: String,
      enum: ['local', 'firebase'],
      default: 'local',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    photoURL: this.photoURL,
    emailVerified: this.emailVerified,
    firebaseUid: this.firebaseUid,
    authProviders: this.authProviders,
    primaryAuthProvider: this.primaryAuthProvider,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);