const mongoose = require('mongoose');

const srsRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    company: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    projectType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    goals: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },

    audience: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },

    features: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },

    userRoles: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },

    integrations: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },

    technology: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },

    timeline: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },

    budget: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'accepted',
        'rejected',
        'expired',
        'completed',
      ],
      default: 'pending',
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    assignedDeveloper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    adminNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },

    // Revision tracking
    approvedAt: {
      type: Date,
      default: null,
    },
    freeRevisionUntil: {
      type: Date,
      default: null,
    },
    latestRevision: {
      type: Number,
      default: 0,
    },
    revisionCount: {
      type: Number,
      default: 0,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup by user and status
srsRequestSchema.index({ user: 1, status: 1 });

// Only ONE pending request per user
srsRequestSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending',
    },
  }
);

module.exports = mongoose.model('SrsRequest', srsRequestSchema);