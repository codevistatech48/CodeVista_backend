const mongoose = require("mongoose");

const SrsRequest = require("../models/srsRequest.model");
const SrsRevision = require("../models/srsRevision.model");
const Project = require("../models/project.model");
const User = require("../models/user.model");
const ActivityLog = require("../models/activityLog.model");

const AppError = require("../utils/AppError");

const {
  createNotification,
  notifyAdmins,
} = require("./notification.service");
const {
  createActivityLog
} = require("./activityLog.service");

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const WORKFLOW_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REVISION_DEVELOPMENT: "revision_development",
  REVISION_TESTING: "revision_testing",
  REVISION_COMPLETED: "revision_completed",
  READY_FOR_MERGE: "ready_for_merge",
  MERGED: "merged",
  REJECTED: "rejected",
};

/*
|--------------------------------------------------------------------------
| VALID TRANSITIONS
|--------------------------------------------------------------------------
| Maps each status to the allowed next statuses.
| Prevents invalid jumps (e.g. pending → merged).
*/

const VALID_TRANSITIONS = {
  [WORKFLOW_STATUS.PENDING]: [
    WORKFLOW_STATUS.UNDER_REVIEW,
    WORKFLOW_STATUS.REJECTED,
  ],

  [WORKFLOW_STATUS.UNDER_REVIEW]: [
    WORKFLOW_STATUS.PENDING,
    WORKFLOW_STATUS.APPROVED,
    WORKFLOW_STATUS.REJECTED,
  ],

  [WORKFLOW_STATUS.APPROVED]: [
    WORKFLOW_STATUS.UNDER_REVIEW,
    WORKFLOW_STATUS.MERGED,
    WORKFLOW_STATUS.REVISION_DEVELOPMENT,
  ],

  [WORKFLOW_STATUS.REVISION_DEVELOPMENT]: [
    WORKFLOW_STATUS.REVISION_TESTING,
  ],

  [WORKFLOW_STATUS.REVISION_TESTING]: [
    WORKFLOW_STATUS.REVISION_COMPLETED,
  ],

  [WORKFLOW_STATUS.REVISION_COMPLETED]: [
    WORKFLOW_STATUS.READY_FOR_MERGE,
  ],

  [WORKFLOW_STATUS.READY_FOR_MERGE]: [
    WORKFLOW_STATUS.MERGED,
  ],

  [WORKFLOW_STATUS.MERGED]: [],

  [WORKFLOW_STATUS.REJECTED]: [],
};

/*
|--------------------------------------------------------------------------
| PROJECT STAGE ORDER (for resume logic)
|--------------------------------------------------------------------------
*/

const PROJECT_STAGES = [
  "accepted",
  "planning",
  "ui_design",
  "development",
  "testing",
  "deployment",
  "completed",
];

const COST_STATUS = {
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
];

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function validateObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid id.", 400);
  }
}

async function getSrsOrThrow(srsId) {
  validateObjectId(srsId);

  const srs = await SrsRequest.findById(srsId);

  if (!srs) {
    throw new AppError("SRS request not found.", 404);
  }

  return srs;
}

async function getRevisionOrThrow(revisionId) {
  validateObjectId(revisionId);

  const revision = await SrsRevision.findById(revisionId);

  if (!revision) {
    throw new AppError("Revision not found.", 404);
  }

  return revision;
}

function canUserAccessSrs(srs, userId, isAdmin = false) {
  if (isAdmin) return true;

  return String(srs.user) === String(userId);
}

function sanitizeChanges(changes = {}) {
  const allowedFields = [
    "projectName",
    "summary",
    "goals",
    "features",
    "technology",
    "timeline",
    "budget",
    "audience",
    "integrations",
    "notes",
    "projectType",
    "userRoles",
  ];

  const output = {};

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      output[key] = changes[key];
    }
  }

  return output;
}
/*
|--------------------------------------------------------------------------
| CREATE REVISION
|--------------------------------------------------------------------------
*/

async function createRevision(srsId, userId, revisionData) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const srs = await getSrsOrThrow(srsId);

    /*
    -------------------------------------------------------
    Authorization
    -------------------------------------------------------
    */

    if (!canUserAccessSrs(srs, userId)) {
      throw new AppError(
        "You are not authorized to create revisions for this project.",
        403
      );
    }

    /*
    -------------------------------------------------------
    SRS must be accepted
    -------------------------------------------------------
    */

    if (srs.status !== "accepted") {
      throw new AppError(
        "Only accepted SRS requests can be revised.",
        400
      );
    }

    /*
    -------------------------------------------------------
    Only one active revision at a time
    -------------------------------------------------------
    */

    const existingPending = await SrsRevision.findOne({
      originalSrs: srs._id,

      workflowStatus: {
        $in: [
          WORKFLOW_STATUS.PENDING,
          WORKFLOW_STATUS.UNDER_REVIEW,
          WORKFLOW_STATUS.APPROVED,
          WORKFLOW_STATUS.REVISION_DEVELOPMENT,
          WORKFLOW_STATUS.REVISION_TESTING,
          WORKFLOW_STATUS.REVISION_COMPLETED,
        ],
      },
    }).session(session);

    if (existingPending) {
      throw new AppError(
        "There is already an active revision request.",
        409
      );
    }

    /*
    -------------------------------------------------------
    Pause Project For Revision
    -------------------------------------------------------
    */

    const project = await Project.findOne({
      srsRequest: srs._id,
      isDeleted: {
        $ne: true
      },
    }).session(session);

    if (project) {
      project.pausedStatus = project.status;
      project.workflowMode = "revision";
      project.lastUpdated = new Date();
      await project.save({
        session
      });
    }

    /*
    -------------------------------------------------------
    Revision Number
    -------------------------------------------------------
    */

    const revisionNumber =
      (srs.latestRevision || 0) + 1;

    /*
    -------------------------------------------------------
    Free Revision
    -------------------------------------------------------
    */

    const now = new Date();

    const isFreeRevision =
      srs.freeRevisionUntil &&
      now <= srs.freeRevisionUntil;

    /*
    -------------------------------------------------------
    Requested Changes
    -------------------------------------------------------
    */

    const requestedChanges = sanitizeChanges(
      revisionData.requestedChanges || {}
    );

    if (
      Object.keys(requestedChanges).length === 0
    ) {
      throw new AppError(
        "No requested changes were supplied.",
        400
      );
    }

    /*
    -------------------------------------------------------
    Previous Snapshot
    -------------------------------------------------------
    */

    const previousSnapshot = {
      projectName: srs.projectName,
      summary: srs.summary,
      goals: srs.goals,
      features: srs.features,
      technology: srs.technology,
      timeline: srs.timeline,
      budget: srs.budget,
      audience: srs.audience,
      integrations: srs.integrations,
      notes: srs.notes,
      projectType: srs.projectType,
      userRoles: srs.userRoles,
    };

    /*
    -------------------------------------------------------
    Priority
    -------------------------------------------------------
    */

    const priority = PRIORITIES.includes(
        revisionData.priority
      ) ?
      revisionData.priority :
      "medium";
    /*
    -------------------------------------------------------
    Create Revision
    -------------------------------------------------------
    */

   const revision = await SrsRevision.create(
  [{
    originalSrs: srs._id,

    project: project ? project._id : null,

    revisionNumber,

    createdBy: userId,

    title:
      revisionData.title ||
      `Revision #${revisionNumber}`,

    changeSummary: revisionData.changeSummary,

    requestedChanges,

    previousSnapshot,

    workflowStatus: WORKFLOW_STATUS.PENDING,

    // NEW
    pausedStatus: project ? project.status : null,

    priority,

    isFreeRevision,

    estimatedCost: 0,

    approvedCost: 0,

    costStatus:
      isFreeRevision
        ? COST_STATUS.NOT_REQUIRED
        : COST_STATUS.PENDING,

    attachments:
      revisionData.attachments || [],

    comments: [
      {
        sender: userId,
        role: "user",
        message: revisionData.changeSummary,
      },
    ],

    activity: [
      {
        action: "Revision Created",
        performedBy: userId,
        role: "user",
        description: `Revision #${revisionNumber} submitted.`,
      },
    ],
  }],
  {
    session,
  }
);

    /*
    -------------------------------------------------------
    Update Original SRS
    -------------------------------------------------------
    */

    srs.revisionCount =
      (srs.revisionCount || 0) + 1;

    srs.latestRevision = revisionNumber;

    await srs.save({
      session
    });

    /*
    -------------------------------------------------------
    Activity Log
    -------------------------------------------------------
    */

    try {
      await createActivityLog({
        actorId: userId,
        action: "revision.created",
        description: `Revision #${revisionNumber} submitted for "${srs.projectName}"`,
        entity: "SrsRevision",
        entityId: revision[0]._id,
        projectId: project ? project._id : null,
        revisionId: revision[0]._id,
        performerRole: "user",
        metadata: {
          revisionNumber,
          originalSrs: srs._id,
          isFreeRevision,
          projectName: srs.projectName,
        },
      });
    } catch (_error) {
      // Activity logging failure should not fail the request
    }

    /*
    -------------------------------------------------------
    Notify Admins
    -------------------------------------------------------
    */

    try {
      await notifyAdmins({
        title: "New Revision Request",

        message: `${srs.projectName} has received Revision #${revisionNumber}.`,

        type: "revision_created",

        entityId: revision[0]._id,
      });
    } catch (err) {
      console.error(
        "Admin notification failed",
        err.message
      );
    }

    /*
    -------------------------------------------------------
    Notify User
    -------------------------------------------------------
    */

    try {
      await createNotification({
        userId,

        title: "Revision Submitted",

        message: "Your revision request has been submitted successfully.",

        type: "revision_submitted",
      });
    } catch (err) {
      console.error(
        "User notification failed",
        err.message
      );
    }

    /*
    -------------------------------------------------------
    Commit
    -------------------------------------------------------
    */

    await session.commitTransaction();

    return revision[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
/*
|--------------------------------------------------------------------------
| GET ALL REVISIONS OF AN SRS
|--------------------------------------------------------------------------
*/

async function getRevisions(
  srsId,
  userId,
  isAdmin = false,
  query = {}
) {
  const srs = await getSrsOrThrow(srsId);

  /*
  -------------------------------------------------------
  Authorization
  -------------------------------------------------------
  */

  if (!canUserAccessSrs(srs, userId, isAdmin)) {
    throw new AppError(
      "You are not authorized to view these revisions.",
      403
    );
  }

  /*
  -------------------------------------------------------
  Filters
  -------------------------------------------------------
  */

  const filter = {
    originalSrs: srs._id,
  };

  if (
    query.workflowStatus &&
    query.workflowStatus !== "all"
  ) {
    filter.workflowStatus = query.workflowStatus;
  }

  if (
    query.priority &&
    query.priority !== "all"
  ) {
    filter.priority = query.priority;
  }

  /*
  -------------------------------------------------------
  Search
  -------------------------------------------------------
  */

  if (query.search) {
    filter.$or = [{
        title: {
          $regex: query.search,
          $options: "i",
        },
      },
      {
        changeSummary: {
          $regex: query.search,
          $options: "i",
        },
      },
    ];
  }

  /*
  -------------------------------------------------------
  Pagination
  -------------------------------------------------------
  */

  const page = Math.max(
    Number(query.page) || 1,
    1
  );

  const limit = Math.max(
    Number(query.limit) || 10,
    1
  );

  const skip = (page - 1) * limit;

  /*
  -------------------------------------------------------
  Fetch Revisions
  -------------------------------------------------------
  */

  const [revisions, total] = await Promise.all([

    SrsRevision.find(filter)

    .populate(
      "createdBy",
      "name email avatar"
    )

    .populate(
      "assignedDeveloper",
      "name email avatar"
    )

    .populate(
      "reviewedBy",
      "name email"
    )

    .sort({
      revisionNumber: -1,
    })

    .skip(skip)

    .limit(limit)

    .lean(),

    SrsRevision.countDocuments(filter),
  ]);

  /*
  -------------------------------------------------------
  Statistics
  -------------------------------------------------------
  */

  const stats = {
    total,

    pending: 0,

    underReview: 0,

    approved: 0,

    development: 0,

    testing: 0,

    completed: 0,

    merged: 0,

    rejected: 0,
  };

  revisions.forEach((revision) => {
    switch (revision.workflowStatus) {
      case WORKFLOW_STATUS.PENDING:
        stats.pending++;
        break;

      case WORKFLOW_STATUS.UNDER_REVIEW:
        stats.underReview++;
        break;

      case WORKFLOW_STATUS.APPROVED:
        stats.approved++;
        break;

      case WORKFLOW_STATUS.REVISION_DEVELOPMENT:
        stats.development++;
        break;

      case WORKFLOW_STATUS.REVISION_TESTING:
        stats.testing++;
        break;

      case WORKFLOW_STATUS.REVISION_COMPLETED:
        stats.completed++;
        break;

      case WORKFLOW_STATUS.MERGED:
        stats.merged++;
        break;

      case WORKFLOW_STATUS.REJECTED:
        stats.rejected++;
        break;

      default:
        break;
    }
  });
  /*
  -------------------------------------------------------
  Return
  -------------------------------------------------------
  */

  return {
    revisions,

    stats,

    pagination: {
      total,

      page,

      limit,

      pages: Math.ceil(total / limit),
    },
  };
}
/*
|--------------------------------------------------------------------------
| GET SINGLE REVISION
|--------------------------------------------------------------------------
*/

async function getRevision(
  revisionId,
  userId,
  isAdmin = false
) {
  const revision = await SrsRevision.findById(revisionId)

    .populate(
      "originalSrs"
    )

    .populate(
      "project",
      "name status progress priority deadline assignedTeam timeline"
    )

    .populate(
      "createdBy",
      "name email avatar"
    )

    .populate(
      "assignedDeveloper",
      "name email avatar phone"
    )

    .populate(
      "reviewedBy",
      "name email"
    )

    .populate(
      "mergedBy",
      "name email"
    )

    .lean();

  if (!revision) {
    throw new AppError(
      "Revision not found.",
      404
    );
  }

  /*
  ---------------------------------------------------------
  Authorization
  ---------------------------------------------------------
  */

  if (
    !canUserAccessSrs(
      revision.originalSrs,
      userId,
      isAdmin
    )
  ) {
    throw new AppError(
      "Unauthorized.",
      403
    );
  }

  /*
  ---------------------------------------------------------
  Generate Diff
  ---------------------------------------------------------
  */

  const diff = [];

  const before =
    revision.previousSnapshot || {};

  const after =
    revision.requestedChanges || {};

  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);

  keys.forEach((field) => {

    const oldValue = before[field];

    const newValue = after[field];

    if (
      JSON.stringify(oldValue) !==
      JSON.stringify(newValue)
    ) {

      diff.push({

        field,

        oldValue,

        newValue,

      });

    }

  });

  /*
  ---------------------------------------------------------
  Timeline
  ---------------------------------------------------------
  */

  const timeline = [

    {
      title: "Revision Submitted",

      date: revision.requestedAt,

      user: revision.createdBy,

      completed: true,
    },

    {
      title: "Under Review",

      date: revision.reviewedAt,

      user: revision.reviewedBy,

      completed: revision.workflowStatus !==
        WORKFLOW_STATUS.PENDING,
    },

    {
      title: "Approved",

      date: revision.approvedAt,

      completed: [
        WORKFLOW_STATUS.APPROVED,
        WORKFLOW_STATUS.REVISION_DEVELOPMENT,
        WORKFLOW_STATUS.REVISION_TESTING,
        WORKFLOW_STATUS.REVISION_COMPLETED,
        WORKFLOW_STATUS.READY_FOR_MERGE,
        WORKFLOW_STATUS.MERGED,
      ].includes(revision.workflowStatus),
    },

    {
      title: "Revision Development",

      completed: [
        WORKFLOW_STATUS.REVISION_DEVELOPMENT,
        WORKFLOW_STATUS.REVISION_TESTING,
        WORKFLOW_STATUS.REVISION_COMPLETED,
        WORKFLOW_STATUS.READY_FOR_MERGE,
        WORKFLOW_STATUS.MERGED,
      ].includes(revision.workflowStatus),
    },

    {
      title: "Revision Testing",

      completed: [
        WORKFLOW_STATUS.REVISION_TESTING,
        WORKFLOW_STATUS.REVISION_COMPLETED,
        WORKFLOW_STATUS.READY_FOR_MERGE,
        WORKFLOW_STATUS.MERGED,
      ].includes(revision.workflowStatus),
    },

    {
      title: "Revision Completed",

      date: revision.completedAt,

      completed: [
        WORKFLOW_STATUS.REVISION_COMPLETED,
        WORKFLOW_STATUS.READY_FOR_MERGE,
        WORKFLOW_STATUS.MERGED,
      ].includes(revision.workflowStatus),
    },

    {
      title: "Ready For Merge",

      completed: [
        WORKFLOW_STATUS.READY_FOR_MERGE,
        WORKFLOW_STATUS.MERGED,
      ].includes(revision.workflowStatus),
    },

    {
      title: "Merged",

      date: revision.mergedAt,

      user: revision.mergedBy,

      completed: revision.workflowStatus ===
        WORKFLOW_STATUS.MERGED,
    },

  ];

  /*
  ---------------------------------------------------------
  Return
  ---------------------------------------------------------
  */

  return {

    revision,

    diff,

    timeline,

  };

}
/*
|--------------------------------------------------------------------------
| REVIEW REVISION (PART A)
|--------------------------------------------------------------------------
*/

async function reviewRevision(
  revisionId,
  admin,
  reviewData
) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const revision = await SrsRevision.findById(
      revisionId
    ).session(session);

    if (!revision) {
      throw new AppError(
        "Revision not found.",
        404
      );
    }

    /*
    -------------------------------------------------------
    Already Reviewed?
    -------------------------------------------------------
    */

    if (
      revision.workflowStatus !==
      WORKFLOW_STATUS.PENDING
    ) {
      throw new AppError(
        "This revision has already been reviewed.",
        400
      );
    }

    /*
    -------------------------------------------------------
    Validate Status
    -------------------------------------------------------
    For the first review step (pending → under_review|rejected),
    only under_review or rejected are valid.
    Approval happens in a separate step after under_review.
    */

    const allowedStatus = VALID_TRANSITIONS[WORKFLOW_STATUS.PENDING];

    if (
      !allowedStatus.includes(
        reviewData.workflowStatus
      )
    ) {
      throw new AppError(
        `Invalid transition from pending. Allowed: ${allowedStatus.join(", ")}`,
        400
      );
    }

    /*
    -------------------------------------------------------
    Load Original SRS
    -------------------------------------------------------
    */

    const srs = await SrsRequest.findById(
      revision.originalSrs
    ).session(session);

    if (!srs) {
      throw new AppError(
        "Original SRS not found.",
        404
      );
    }

    /*
    -------------------------------------------------------
    Update Review
    -------------------------------------------------------
    */

    revision.workflowStatus =
      reviewData.workflowStatus;

    revision.reviewedBy = admin._id;

    revision.reviewedAt = new Date();

    revision.reviewComment =
      reviewData.reviewComment || "";

    /*
    -------------------------------------------------------
    Estimated Cost
    -------------------------------------------------------
    */

    if (
      typeof reviewData.estimatedCost ===
      "number"
    ) {

      revision.estimatedCost =
        reviewData.estimatedCost;

      if (
        reviewData.estimatedCost > 0
      ) {

        revision.costStatus =
          COST_STATUS.PENDING;

      } else {

        revision.costStatus =
          COST_STATUS.NOT_REQUIRED;

      }

    }

    /*
    -------------------------------------------------------
    Priority
    -------------------------------------------------------
    */

    if (
      PRIORITIES.includes(
        reviewData.priority
      )
    ) {

      revision.priority =
        reviewData.priority;

    }

    /*
    -------------------------------------------------------
    Activity Timeline
    -------------------------------------------------------
    */

    revision.activity.push({

      action: reviewData.workflowStatus ===
        WORKFLOW_STATUS.APPROVED ?
        "Revision Approved" : reviewData.workflowStatus ===
        WORKFLOW_STATUS.REJECTED ?
        "Revision Rejected" : "Revision Under Review",

      performedBy: admin._id,

      role: "admin",

      description: reviewData.reviewComment ||
        "",

    });

    /*
    -------------------------------------------------------
    Discussion Thread
    -------------------------------------------------------
    */

    if (
      reviewData.reviewComment
    ) {

      revision.comments.push({

        sender: admin._id,

        role: "admin",

        message: reviewData.reviewComment,

      });

    }

    /*
    -------------------------------------------------------
    Sync Project Status
    -------------------------------------------------------
    Update the project document to reflect the revision status change
    */

    /*
-------------------------------------------------------
Sync Project Status
-------------------------------------------------------
*/

const srsForProject = await SrsRequest.findById(revision.originalSrs).session(session);

if (srsForProject) {
  const project = await Project.findOne({
    srsRequest: srsForProject._id,
    isDeleted: { $ne: true },
  }).session(session);

  if (project) {
    switch (reviewData.workflowStatus) {
      case WORKFLOW_STATUS.UNDER_REVIEW:
        project.workflowMode = "revision";
        project.lastUpdated = new Date();
        break;

      case WORKFLOW_STATUS.APPROVED:
        project.workflowMode = "revision";
        project.lastUpdated = new Date();
        break;

      case WORKFLOW_STATUS.REJECTED:
        project.status = project.pausedStatus || project.status;
        project.workflowMode = "normal";
        project.pausedStatus = null;
        project.lastUpdated = new Date();
        break;
    }

    await project.save({ session });
  }
}

    /*
    -------------------------------------------------------
    Save Revision
    -------------------------------------------------------
    */
   await revision.save({ session });

   /*
-------------------------------------------------------
Activity Log
-------------------------------------------------------
*/

try {
  await createActivityLog({
    actorId: admin._id,
    action: `revision.${revision.workflowStatus}`,
    description: `Revision #${revision.revisionNumber} ${revision.workflowStatus}`,
    entity: "SrsRevision",
    entityId: revision._id,
    projectId: revision.project || null,
    revisionId: revision._id,
    performerRole: "admin",
    metadata: {
      revisionNumber: revision.revisionNumber,
      workflowStatus: revision.workflowStatus,
      estimatedCost: revision.estimatedCost,
      originalSrs: revision.originalSrs,
    },
  });
} catch (_) {}

/*
-------------------------------------------------------
Notify User
-------------------------------------------------------
*/

try {
  await createNotification({
    userId: srs.user,
    title:
      revision.workflowStatus === WORKFLOW_STATUS.UNDER_REVIEW
        ? "Revision Under Review"
        : "Revision Rejected",
    message:
      revision.reviewComment ||
      `Revision #${revision.revisionNumber} has been ${revision.workflowStatus}.`,
    type: "revision_review",
  });
} catch (err) {
  console.error(err.message);
}

/*
-------------------------------------------------------
SAVE REVISION
-------------------------------------------------------
*/

await revision.save({ session });

/*
-------------------------------------------------------
Commit
-------------------------------------------------------
*/

await session.commitTransaction();

return revision;

    /*
    -------------------------------------------------------
    Commit Transaction
    -------------------------------------------------------
    */

    await session.commitTransaction();

    return revision;

  } catch (error) {

    await session.abortTransaction();

    throw error;

  } finally {

    session.endSession();

  }

}
/*
|--------------------------------------------------------------------------
| UPDATE REVISION COST
|--------------------------------------------------------------------------
*/

async function updateRevisionCost(
  revisionId,
  admin,
  payload
) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const revision = await SrsRevision.findById(
      revisionId
    ).session(session);

    if (!revision) {
      throw new AppError(
        "Revision not found.",
        404
      );
    }

    /*
    -------------------------------------------------------
    Validate Cost
    -------------------------------------------------------
    */

    const cost = Number(payload.estimatedCost);

    if (
      Number.isNaN(cost) ||
      cost < 0
    ) {
      throw new AppError(
        "Estimated cost must be a valid positive number.",
        400
      );
    }

    /*
    -------------------------------------------------------
    Update Cost
    -------------------------------------------------------
    */

    revision.estimatedCost = cost;

    revision.costStatus =
      cost === 0 ?
      COST_STATUS.NOT_REQUIRED :
      COST_STATUS.PENDING;

    /*
    -------------------------------------------------------
    Add Admin Comment
    -------------------------------------------------------
    */

    if (payload.comment) {

      revision.comments.push({

        sender: admin._id,

        role: "admin",

        message: payload.comment,

      });

    }

    /*
    -------------------------------------------------------
    Activity Timeline
    -------------------------------------------------------
    */

    revision.activity.push({

      action: "Cost Updated",

      performedBy: admin._id,

      role: "admin",

      description: cost === 0 ?
        "Revision marked as free." : `Estimated cost updated to ₹${cost}.`,

    });

    await revision.save({
      session
    });

    /*
    -------------------------------------------------------
    Activity Log
    -------------------------------------------------------
    */

    try {
      await createActivityLog({
        actorId: admin._id,
        action: "revision.cost.updated",
        description: cost === 0 ? "Revision marked as free" : `Estimated cost updated to ₹${cost}`,
        entity: "SrsRevision",
        entityId: revision._id,
        projectId: revision.project || null,
        revisionId: revision._id,
        performerRole: "admin",
        metadata: {
          estimatedCost: cost,
          revisionNumber: revision.revisionNumber,
        },
      });
    } catch (_error) {
      // Activity logging failure should not fail the request
    }

    /*
    -------------------------------------------------------
    Notify User
    -------------------------------------------------------
    */

    try {

      const srs =
        await SrsRequest.findById(
          revision.originalSrs
        ).session(session);

      if (srs) {

        await createNotification({

          userId: srs.user,

          title: "Revision Cost Updated",

          message: cost === 0 ?
            "Your revision has been marked as free." : `Estimated revision cost is ₹${cost}.`,

          type: "revision_cost",

        });

      }

    } catch (err) {

      console.error(
        "Notification Error:",
        err.message
      );

    }

    /*
    -------------------------------------------------------
    Commit
    -------------------------------------------------------
    */

    await session.commitTransaction();

    return revision;

  } catch (error) {

    await session.abortTransaction();

    throw error;

  } finally {

    session.endSession();

  }

}
/*
|--------------------------------------------------------------------------
| RESPOND TO COST (USER ACTION)
|--------------------------------------------------------------------------
*/

async function respondToCost(revisionId, userId, payload) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const revision = await SrsRevision.findById(revisionId).session(session);
    if (!revision) {
      throw new AppError("Revision not found.", 404);
    }

    const srs = await SrsRequest.findById(revision.originalSrs).session(session);
    if (!srs || !canUserAccessSrs(srs, userId)) {
      throw new AppError("You are not authorized to respond to this billing proposal.", 403);
    }

    if (revision.costStatus !== COST_STATUS.PENDING) {
      throw new AppError("There is no active pending cost proposal for this revision.", 400);
    }

    const {
      action
    } = payload; // expected 'accept' or 'reject'
    if (!["accept", "reject"].includes(action)) {
      throw new AppError("Invalid cost response action.", 400);
    }

    if (action === "accept") {
      revision.costStatus = COST_STATUS.ACCEPTED;
      revision.approvedCost = revision.estimatedCost;
      // If previously approved but stalled on billing, progress workflow status
      if (revision.workflowStatus === WORKFLOW_STATUS.PENDING) {
        revision.workflowStatus = WORKFLOW_STATUS.UNDER_REVIEW;
      }
    } else {
      revision.costStatus = COST_STATUS.REJECTED;
      revision.workflowStatus = WORKFLOW_STATUS.REJECTED;
    }

    revision.activity.push({
      action: action === "accept" ? "Cost Accepted" : "Cost Rejected",
      performedBy: userId,
      role: "user",
      description: action === "accept" ?
        `User accepted the estimated cost of ₹${revision.estimatedCost}.` : `User rejected the cost estimate. Revision request halted.`,
    });

    await revision.save({
      session
    });

    try {
      await createActivityLog({
        actorId: userId,
        action: `revision.cost.${action}ed`,
        description: action === "accept" ? `User accepted cost of ₹${revision.estimatedCost}` : "User rejected cost estimate",
        entity: "SrsRevision",
        entityId: revision._id,
        projectId: revision.project || null,
        revisionId: revision._id,
        performerRole: "user",
        metadata: {
          revisionNumber: revision.revisionNumber,
          cost: revision.estimatedCost
        },
      });
    } catch (_error) {
      // Activity logging failure should not fail the request
    }

    try {
      await notifyAdmins({
        title: `Revision Cost ${action === "accept" ? "Accepted" : "Rejected"}`,
        message: `Client has ${action}ed the billing proposal of ₹${revision.estimatedCost} for ${srs.projectName} (Rev #${revision.revisionNumber}).`,
        type: "revision_cost_response",
        entityId: revision._id,
      });
    } catch (err) {
      console.error("Admin notification failed", err.message);
    }

    await session.commitTransaction();
    return revision;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/*
|--------------------------------------------------------------------------
| ASSIGN DEVELOPER (ADMIN ACTION)
|--------------------------------------------------------------------------
*/

async function assignDeveloper(revisionId, adminId, payload) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const revision = await SrsRevision.findById(revisionId).session(session);
    if (!revision) {
      throw new AppError("Revision not found.", 404);
    }

    const {
      developerId
    } = payload;
    validateObjectId(developerId);

    const developer = await User.findOne({
      _id: developerId,
      role: "developer"
    }).session(session);
    if (!developer) {
      throw new AppError("Valid target developer account not found.", 404);
    }

    revision.assignedDeveloper = developer._id;

    // Auto-advance workflow state if it's sitting idle post-approval
    if ([WORKFLOW_STATUS.APPROVED].includes(revision.workflowStatus)) {
      revision.workflowStatus = WORKFLOW_STATUS.REVISION_DEVELOPMENT;
    }

    revision.activity.push({
      action: "Developer Assigned",
      performedBy: adminId,
      role: "admin",
      description: `Assigned task workflow to engineering team: ${developer.name}.`,
    });

    await revision.save({
      session
    });

    try {
      await createActivityLog({
        actorId: adminId,
        action: "revision.developer.assigned",
        description: `Developer ${developer.name} assigned to Revision #${revision.revisionNumber}`,
        entity: "SrsRevision",
        entityId: revision._id,
        projectId: revision.project || null,
        revisionId: revision._id,
        performerRole: "admin",
        metadata: {
          developerId: developer._id,
          revisionNumber: revision.revisionNumber,
          developerName: developer.name
        },
      });
    } catch (_error) {
      // Activity logging failure should not fail the request
    }

    try {
      await createNotification({
        userId: developer._id,
        title: "New Revision Workspace Assignment",
        message: `You have been explicitly assigned to carry out functional items on Revision #${revision.revisionNumber}.`,
        type: "revision_assignment",
      });
    } catch (err) {
      console.error("Developer notification workspace link error:", err.message);
    }

    await session.commitTransaction();
    return revision;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/*
|--------------------------------------------------------------------------
| UPDATE WORKFLOW STATUS (ADMIN / DEVELOPER ACTION)
|--------------------------------------------------------------------------
*/

async function updateWorkflowStatus(revisionId, staffId, role, payload) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const revision = await SrsRevision.findById(revisionId).session(session);
    if (!revision) {
      throw new AppError("Revision not found.", 404);
    }

    // Role safety logic gates
    if (role === "developer" && String(revision.assignedDeveloper) !== String(staffId)) {
      throw new AppError("You are not the assigned engineer on this revision layout.", 403);
    }

    const {
      status
    } = payload;
    if (!Object.values(WORKFLOW_STATUS).includes(status)) {
      throw new AppError("Invalid workflow status.", 400);
    }

    /*
    -------------------------------------------------------
    Validate Transition
    -------------------------------------------------------
    */

    const pastStatus = revision.workflowStatus;
    const allowedNext = VALID_TRANSITIONS[pastStatus];

    if (!allowedNext || !allowedNext.includes(status)) {
      throw new AppError(
        `Invalid transition from ${pastStatus} to ${status}. Allowed: ${(allowedNext || []).join(", ")}`,
        400
      );
    }

    revision.workflowStatus = status;

    // Capture lifecycle updates
    if (status === WORKFLOW_STATUS.APPROVED && !revision.approvedAt) {
      revision.approvedAt = new Date();
    }
    if (status === WORKFLOW_STATUS.REVISION_COMPLETED && !revision.completedAt) {
      revision.completedAt = new Date();
    }
    if (status === WORKFLOW_STATUS.MERGED && !revision.mergedAt) {
      revision.mergedAt = new Date();
      revision.mergedBy = staffId;
    }

    revision.activity.push({
      action: `Status Transition`,
      performedBy: staffId,
      role: role,
      description: `Pipeline phase safely mapped from ${pastStatus} to ${status}.`,
    });

    await revision.save({
      session
    });

    /*
    -------------------------------------------------------
    Apply Changes To Original SRS When Approved
    -------------------------------------------------------
    */

    if (status === WORKFLOW_STATUS.APPROVED) {
      const srs = await SrsRequest.findById(revision.originalSrs).session(session);
      if (srs) {
        Object.entries(revision.requestedChanges || {}).forEach(([field, value]) => {
          srs[field] = value;
        });
        srs.latestRevision = revision.revisionNumber;
        await srs.save({
          session
        });
      }

      // Sync project status when revision is approved
      const project = await Project.findOne({
        srsRequest: srs._id,
        isDeleted: {
          $ne: true
        },
      }).session(session);

      if (project) {
        project.workflowMode = "revision";
        project.lastUpdated = new Date();
        await project.save({
          session
        });
      }
    }

    /*
    -------------------------------------------------------
    Restore Project When Merged
    -------------------------------------------------------
    Return to the paused stage. The admin advances the project manually.
    */

    if (status === WORKFLOW_STATUS.MERGED) {
      const srs = await SrsRequest.findById(revision.originalSrs).session(session);
      if (srs) {
        const project = await Project.findOne({
          srsRequest: srs._id,
          isDeleted: {
            $ne: true
          },
        }).session(session);

        if (project) {
          project.status = project.pausedStatus || project.status;
          project.workflowMode = "normal";
          project.pausedStatus = null;
          project.lastUpdated = new Date();
          await project.save({
            session
          });
        }
      }
    }

    /*
    -------------------------------------------------------
    Restore Project When Rejected
    -------------------------------------------------------
    Return to the paused status and normal workflow mode.
    */

    if (status === WORKFLOW_STATUS.REJECTED) {
      const srs = await SrsRequest.findById(revision.originalSrs).session(session);
      if (srs) {
        const project = await Project.findOne({
          srsRequest: srs._id,
          isDeleted: {
            $ne: true
          },
        }).session(session);

        if (project) {
          // Return to original paused status
          if (project.pausedStatus) {
            project.status = project.pausedStatus;
          }
          project.workflowMode = "normal";
          project.pausedStatus = null;
          project.lastUpdated = new Date();
          await project.save({
            session
          });
        }
      }
    }

    try {
      await createActivityLog({
        actorId: staffId,
        action: `revision.workflow.${status}`,
        description: `Revision #${revision.revisionNumber} status changed from ${pastStatus} to ${status}`,
        entity: "SrsRevision",
        entityId: revision._id,
        projectId: revision.project || null,
        revisionId: revision._id,
        performerRole: role,
        metadata: {
          pastStatus,
          nextStatus: status,
          revisionNumber: revision.revisionNumber
        },
      });
    } catch (_error) {
      // Activity logging failure should not fail the request
    }

    // Sync pipeline records downstream to client spaces
    try {
      const srs = await SrsRequest.findById(revision.originalSrs).session(session);
      if (srs) {
        await createNotification({
          userId: srs.user,
          title: "Project Milestone Updated",
          message: `Your change validation record Rev #${revision.revisionNumber} modern phase status flag set: ${status}.`,
          type: "revision_pipeline_update",
        });
      }
    } catch (err) {
      console.error("State synchronization notification failed", err.message);
    }

    await session.commitTransaction();
    return revision;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function listAllRevisions(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 20, 1);
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.workflowStatus && query.workflowStatus !== "all") {
    filter.workflowStatus = query.workflowStatus;
  }

  if (query.priority && query.priority !== "all") {
    filter.priority = query.priority;
  }

  if (query.search) {
    filter.$or = [{
        title: {
          $regex: query.search,
          $options: "i"
        }
      },
      {
        changeSummary: {
          $regex: query.search,
          $options: "i"
        }
      }
    ];
  }

  const [items, total] = await Promise.all([
    SrsRevision.find(filter)
    .populate("createdBy", "name email")
    .populate("project", "name")
    .populate("originalSrs", "projectName")
    .sort({
      requestedAt: -1
    })
    .skip(skip)
    .limit(limit)
    .lean(),

    SrsRevision.countDocuments(filter)
  ]);

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  };
}

/*
|--------------------------------------------------------------------------
| ADD DISCUSSION COMMENT (MUTUAL OBJECT)
|--------------------------------------------------------------------------
*/

async function addComment(revisionId, userId, role, payload) {
  const revision = await SrsRevision.findById(revisionId);
  if (!revision) {
    throw new AppError("Revision not found.", 404);
  }

  const srs = await SrsRequest.findById(revision.originalSrs);
  if (!srs) {
    throw new AppError("Associated source document mapping layer is broken.", 404);
  }

  // Authorize comment access placement hooks
  if (role === "user" && String(srs.user) !== String(userId)) {
    throw new AppError("Access Denied.", 403);
  }
  if (role === "developer" && String(revision.assignedDeveloper) !== String(userId)) {
    throw new AppError("Access Denied.", 403);
  }

  const {
    message
  } = payload;
  if (!message || message.trim().length === 0) {
    throw new AppError("Comment text bodies cannot evaluate as empty text expressions.", 400);
  }

  const commentObj = {
    sender: userId,
    role: role,
    message: message.trim(),
    createdAt: new Date()
  };

  revision.comments.push(commentObj);
  await revision.save();

  // Handle reciprocal notifications between actors
  try {
    if (role === "admin" || role === "developer") {
      await createNotification({
        userId: srs.user,
        title: "New Discussion Reply",
        message: `An engineer or administrator posted a new note to Revision Workspace #${revision.revisionNumber}.`,
        type: "revision_comment",
      });
    } else if (role === "user") {
      await notifyAdmins({
        title: "Client Workspace Message",
        message: `Client added an open inquiry message thread into Document Session Rev #${revision.revisionNumber}.`,
        type: "revision_comment",
        entityId: revision._id,
      });
    }
  } catch (err) {
    console.error("Thread sync message dispatch error:", err.message);
  }

  return commentObj;
}

module.exports = {
  createRevision,
  getRevisions,
  listAllRevisions,
  getRevision,
  reviewRevision,
  updateRevisionCost,
  respondToCost,
  assignDeveloper,
  updateWorkflowStatus,
  addComment
};
