const mongoose = require("mongoose");

const revisionCommentSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin", "developer"],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    role: {
      type: String,
      enum: ["user", "admin", "developer", "system"],
      default: "system",
    },

    description: {
      type: String,
      default: "",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    size: Number,
    mimeType: String,

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const srsRevisionSchema = new mongoose.Schema(
  {
    /*
    ===========================================================
    RELATIONS
    ===========================================================
    */

    originalSrs: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SrsRequest",
      required: true,
      index: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedDeveloper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    mergedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
    ===========================================================
    REVISION
    ===========================================================
    */

    revisionNumber: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    changeSummary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    requestedChanges: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    previousSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /*
    ===========================================================
    WORKFLOW
    ===========================================================
    */

    workflowStatus: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "approved",
        "revision_development",
        "revision_testing",
        "revision_completed",
        "ready_for_merge",
        "merged",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    // NEW FIELD
    pausedStatus: {
      type: String,
      enum: [
        "accepted",
        "planning",
        "ui_design",
        "development",
        "testing",
        "deployment",
        "completed",
      ],
      default: null,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    /*
    ===========================================================
    COST
    ===========================================================
    */

    isFreeRevision: {
      type: Boolean,
      default: true,
    },

    estimatedCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    approvedCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    costStatus: {
      type: String,
      enum: [
        "not_required",
        "pending",
        "accepted",
        "rejected",
      ],
      default: "not_required",
    },

    /*
    ===========================================================
    TIMELINE
    ===========================================================
    */

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    reviewedAt: Date,

    approvedAt: Date,

    estimatedCompletion: Date,

    completedAt: Date,

    mergedAt: Date,

    /*
    ===========================================================
    REVIEW
    ===========================================================
    */

    reviewComment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    /*
    ===========================================================
    FILES
    ===========================================================
    */

    attachments: [attachmentSchema],

    /*
    ===========================================================
    DISCUSSION
    ===========================================================
    */

    comments: [revisionCommentSchema],

    /*
    ===========================================================
    HISTORY
    ===========================================================
    */

    activity: [activitySchema],
  },
  {
    timestamps: true,
  }
);

/*
===========================================================
INDEXES
===========================================================
*/

srsRevisionSchema.index(
  {
    originalSrs: 1,
    revisionNumber: 1,
  },
  {
    unique: true,
  }
);

srsRevisionSchema.index({
  workflowStatus: 1,
  requestedAt: -1,
});

srsRevisionSchema.index({
  project: 1,
  workflowStatus: 1,
});

module.exports = mongoose.model(
  "SrsRevision",
  srsRevisionSchema
);