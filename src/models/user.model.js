const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ----------------------------
    // Basic Information
    // ----------------------------
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

    // ----------------------------
    // Profile
    // ----------------------------
    photoURL: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    company: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    website: {
      type: String,
      default: "",
      trim: true,
    },

    github: {
      type: String,
      default: "",
      trim: true,
    },

    linkedin: {
      type: String,
      default: "",
      trim: true,
    },

    // ----------------------------
    // Authentication
    // ----------------------------
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'project_manager', 'developer'],
      default: 'user',
      index: true,
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    authProvider: {
      type: String,
      enum: [
        "local",
        "google.com",
        "github.com",
      ],
      default: "local",
    },

    authProviders: {
      type: [String],
      default: ["local"],
    },

    primaryAuthProvider: {
      type: String,
      enum: [
        "local",
        "google.com",
        "github.com",
      ],
      default: "local",
    },

    // ----------------------------
    // Activity
    // ----------------------------
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,

    // Basic
    name: this.name,
    email: this.email,

    // Profile
    photoURL: this.photoURL,
    avatar: this.photoURL,
    bio: this.bio,
    company: this.company,
    location: this.location,
    website: this.website,
    github: this.github,
    linkedin: this.linkedin,

    // Authentication
    emailVerified: this.emailVerified,
    role: this.role,
    status: this.status,
    firebaseUid: this.firebaseUid,
    authProvider: this.authProvider,
    authProviders: this.authProviders,
    primaryAuthProvider: this.primaryAuthProvider,

    // Activity
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("User", userSchema);
