const mongoose = require('mongoose');
const SrsRequest = require('../models/srsRequest.model');
const SrsRevision = require('../models/srsRevision.model');
const Project = require('../models/project.model');
const ActivityLog = require('../models/activityLog.model');
const AppError = require('../utils/AppError');

/**
 * Get aggregated stats for a user's dashboard.
 */
async function getStats(userId) {
  const objectId = new mongoose.Types.ObjectId(userId);

  const [srsCounts, projectCounts] = await Promise.all([
    // Aggregate SRS requests by status for this user
    SrsRequest.aggregate([{
        $match: {
          user: objectId,
          isDeleted: {
            $ne: true
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: {
            $sum: 1
          }
        }
      },
    ]),
    // Aggregate projects by status for this user
    Project.aggregate([{
        $match: {
          user: objectId,
          isDeleted: {
            $ne: true
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: {
            $sum: 1
          }
        }
      },
    ]),
  ]);

  // Build counts map
  const srsMap = Object.fromEntries(srsCounts.map((s) => [s._id, s.count]));
  const projectMap = Object.fromEntries(projectCounts.map((p) => [p._id, p.count]));

  // Compute in-progress projects (planning, ui_design, development, testing, deployment, active)
  const inProgressStatuses = ['planning', 'ui_design', 'development', 'testing', 'deployment', 'active'];
  const inProgress = inProgressStatuses.reduce((sum, s) => sum + (projectMap[s] || 0), 0);

  return {
    totalSrsRequests: (srsMap.pending || 0) + (srsMap.approved || 0) + (srsMap.accepted || 0) + (srsMap.rejected || 0) + (srsMap.completed || 0) + (srsMap.expired || 0),
    pendingRequests: srsMap.pending || 0,
    acceptedProjects: srsMap.accepted || 0,
    completedProjects: projectMap.completed || 0,
    inProgressProjects: inProgress,
    rejectedRequests: srsMap.rejected || 0,
  };
}

/**
 * Get all projects for a user with SRS request data populated.
 */
async function getProjects(userId) {
  const projects = await Project.find({
      user: userId,
      isDeleted: {
        $ne: true
      }
    })
    .populate('srsRequest', 'projectName summary technology status')
    .populate('assignedTeam', 'name email photoURL')
    .sort({
      createdAt: -1
    })
    .lean();

  const formattedProjects = await Promise.all(
    projects.map(async (project) => {
      const formatted = formatProject(project);

      const latestRevision = await SrsRevision.findOne({
        project: project._id,
      })
        .sort({
          revisionNumber: -1,
        })
        .lean();

      formatted.displayStatus = getDisplayStatus(
        project,
        latestRevision?.workflowStatus
      );

      return formatted;
    })
  );

  return formattedProjects;
}

/*
|--------------------------------------------------------------------------
| PROJECT STAGE ORDER
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

const PROJECT_TITLES = {
  accepted: "Accepted",
  planning: "Planning",
  ui_design: "UI Design",
  development: "Development",
  testing: "Testing",
  deployment: "Deployment",
  completed: "Completed",
};

/*
|--------------------------------------------------------------------------
| REVISION STAGE ORDER
|--------------------------------------------------------------------------
*/

const REVISION_STAGES = [{
    key: "submitted",
    label: "Revision Submitted"
  },
  {
    key: "under_review",
    label: "Under Review"
  },
  {
    key: "approved",
    label: "Approved"
  },
  {
    key: "revision_development",
    label: "Revision Development"
  },
  {
    key: "revision_testing",
    label: "Revision Testing"
  },
  {
    key: "revision_completed",
    label: "Revision Completed"
  },
  {
    key: "ready_for_merge",
    label: "Ready For Merge"
  },
  {
    key: "merged",
    label: "Merged"
  },
];

const REVISION_STATUS_ORDER = {
  submitted: 0,
  under_review: 1,
  approved: 2,
  revision_development: 3,
  revision_testing: 4,
  revision_completed: 5,
  ready_for_merge: 6,
  merged: 7,
  rejected: -1,
};

/*
|--------------------------------------------------------------------------
| TIMELINE ITEM BUILDER
|--------------------------------------------------------------------------
| Produces a consistent timeline item with:
| - New fields: id, key, title, type, state, completed, current, timestamp, sourceId
| - Legacy fields: stage, status, date (backward compatible)
*/

function makeTimelineItem({
  key,
  title,
  type,
  state,
  timestamp,
  sourceId
}) {
  const completed = state === "completed";
  const current = state === "in_progress";

  return {
    id: `${type}_${key}_${String(sourceId).slice(-8)}`,
    key,
    title,
    type,
    state,
    completed,
    current,
    timestamp: timestamp || null,
    sourceId: String(sourceId),
    // Legacy backward-compatible fields
    stage: key,
    status: state,
    date: timestamp || null,
    label: title,
  };
}

/**
 * Build a combined timeline based on workflowMode.
 */
/**
 * Build a combined timeline based on workflowMode.
 */
async function buildCombinedTimeline(project) {
  const projectId = project._id;
  const projectTimeline = project.timeline || [];

  // 1. Fetch all revisions sorted chronologically
  const revisions = await SrsRevision.find({ project: projectId })
    .sort({ revisionNumber: 1 })
    .lean();

  const latestRevision = revisions.length > 0 ? revisions[revisions.length - 1] : null;
  const hasAnyRevision = revisions.length > 0;

  // Helper map for tracking milestone dates per revision stage
  const getStageTimestamp = (rev, stageKey) => {
    const map = {
      submitted: rev.requestedAt || rev.createdAt,
      under_review: rev.reviewedAt,
      approved: rev.approvedAt,
      revision_development: rev.devStartedAt,
      revision_testing: rev.testingStartedAt,
      revision_completed: rev.completedAt,
      ready_for_merge: rev.readyForMergeAt,
      merged: rev.mergedAt,
      rejected: rev.rejectedAt || rev.updatedAt,
    };
    return map[stageKey] || null;
  };

  // Helper to create project timeline items
  const formatProjectItem = (t, forcedState = null) =>
    makeTimelineItem({
      key: t.stage,
      title: PROJECT_TITLES[t.stage] || t.stage,
      type: "project",
      state: forcedState || t.status,
      timestamp: t.date,
      sourceId: projectId,
    });

  // Default: Normal mode with no revisions
  if (!hasAnyRevision) {
    return projectTimeline.map((t) => formatProjectItem(t));
  }

  const combinedTimeline = [];
  let currentProjectIdx = 0;

  // 2. Loop over every historical and active revision in order
  for (let i = 0; i < revisions.length; i++) {
    const rev = revisions[i];
    const isLatest = i === revisions.length - 1;
    const revStatus = rev.workflowStatus;
    const revIndex = REVISION_STATUS_ORDER[revStatus] ?? -1;
    const pausedStage = rev.pausedStatus || project.pausedStatus;
    const pausedIndex = PROJECT_STAGES.indexOf(pausedStage);

    // Add completed project stages prior to/up to the paused point
    while (
      currentProjectIdx < projectTimeline.length &&
      currentProjectIdx <= (pausedIndex >= 0 ? pausedIndex : currentProjectIdx)
    ) {
      combinedTimeline.push(formatProjectItem(projectTimeline[currentProjectIdx], "completed"));
      currentProjectIdx++;
    }

    // 3. Process non-active (historical or completed) revisions
    if (!isLatest || project.workflowMode !== "revision") {
      if (revStatus === "rejected") {
        const rejectedStages = [
          { key: "submitted", title: "Revision Submitted", state: "completed" },
          { key: "under_review", title: "Under Review", state: "completed" },
          { key: "rejected", title: "Rejected", state: "rejected" },
        ];

        rejectedStages.forEach((s) => {
          combinedTimeline.push(
            makeTimelineItem({
              key: s.key,
              title: s.title,
              type: "revision",
              state: s.state,
              timestamp: getStageTimestamp(rev, s.key),
              sourceId: String(rev._id),
            })
          );
        });
      } else {
        // Merged / Historical Completed Revision
        REVISION_STAGES.forEach((stage) => {
          combinedTimeline.push(
            makeTimelineItem({
              key: stage.key,
              title: stage.label,
              type: "revision",
              state: "completed",
              timestamp: getStageTimestamp(rev, stage.key),
              sourceId: String(rev._id),
            })
          );
        });
      }
      continue;
    }

    // 4. Process active revision (only applies to the latest revision when workflowMode === "revision")
    REVISION_STAGES.forEach((stage, idx) => {
      let state = "pending";
      if (idx < revIndex) state = "completed";
      else if (idx === revIndex) state = "in_progress";

      combinedTimeline.push(
        makeTimelineItem({
          key: stage.key,
          title: stage.label,
          type: "revision",
          state,
          timestamp: getStageTimestamp(rev, stage.key),
          sourceId: String(rev._id),
        })
      );
    });
  }

  // 5. Append remaining project stages if the active/latest revision is merged or workflow returned to normal
  if (project.workflowMode !== "revision") {
    const latestStatus = latestRevision?.workflowStatus;
    if (latestStatus === "merged") {
      while (currentProjectIdx < projectTimeline.length) {
        const t = projectTimeline[currentProjectIdx];
        combinedTimeline.push(formatProjectItem(t));
        currentProjectIdx++;
      }
    }
  }

  return combinedTimeline;
}

function getDisplayStatus(project, revisionStatus = null) {
  if (project.workflowMode !== "revision") {
    return project.status;
  }

  const statusMap = {
    submitted: "Revision Submitted",
    under_review: "Revision Under Review",
    approved: "Revision Approved",
    revision_development: "Revision Development",
    revision_testing: "Revision Testing",
    revision_completed: "Revision Completed",
    ready_for_merge: "Ready For Merge",
    merged: "Merged",
    rejected: "Revision Rejected",
  };

  return statusMap[revisionStatus] || project.status;
}

/**
 * Get a single project by ID with access check.
 */
async function getProjectDetails(projectId, userId, isAdmin) {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new AppError('Invalid project id', 400);
  }

  const project = await Project.findById(projectId)
    .populate(
      "srsRequest",
      `
  projectName
  summary
  technology
  status
  fullName
  email
  company
  phone
  goals
  audience
  features
  userRoles
  integrations
  timeline
  budget
  notes
  approvedAt
  freeRevisionUntil
  latestRevision
  revisionCount
  adminNote
  reviewedAt
  `
    )
    .populate('assignedTeam', 'name email photoURL role')
    .populate('user', 'name email photoURL')
    .lean();

  if (!project || project.isDeleted) {
    throw new AppError('Project not found', 404);
  }

  // Access control: users can only see their own projects, admins can see all
  if (!isAdmin && String(project.user ?._id || project.user) !== String(userId)) {
    throw new AppError('Project not found', 404);
  }

  const formatted = formatProject(project);
  const latestRevision = await SrsRevision.findOne({
      project: project._id,
    })
    .sort({
      revisionNumber: -1
    })
    .lean();

  formatted.displayStatus = getDisplayStatus(
    project,
    latestRevision ?.workflowStatus
  );

  // Build combined timeline based on workflowMode
  formatted.timeline = await buildCombinedTimeline(project);

  return formatted;
}

/**
 * Get recent activity for a user.
 */
async function getActivity(userId, limit = 20) {
  const activities = await ActivityLog.find({
      actor: userId
    })
    .sort({
      createdAt: -1
    })
    .limit(limit)
    .lean();

  return activities.map((a) => ({
    id: String(a._id),
    action: a.action,
    entity: a.entity,
    metadata: a.metadata || null,
    createdAt: a.createdAt,
  }));
}

/**
 * Get activity logs for a project
 */
async function getProjectActivityLogs(projectId, userId, isAdmin = false, query = {}) {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new AppError('Invalid project id', 400);
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Access control: users can only see their own projects, admins can see all
  if (!isAdmin && String(project.user) !== String(userId)) {
    throw new AppError('Project not found', 404);
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {
    projectId
  };

  // Apply type filter
  if (query.type && query.type !== 'all') {
    const typeMap = {
      'project': ['project.created', 'project.accepted', 'project.status_updated', 'project.completed'],
      'revision': ['revision.created', 'revision.under_review', 'revision.approved', 'revision.rejected', 'revision.merged', 'revision.developer_assigned'],
      'admin': ['project.status_updated', 'revision.status_changed', 'developer.changed'],
      'status': ['project.status_updated', 'revision.status_changed'],
      'developer': ['developer.assigned', 'revision.developer_assigned'],
    };
    const actions = typeMap[query.type] || [query.type];
    filter.action = {
      $in: actions
    };
  }

  // Apply search
  if (query.search) {
    const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{
        action: regex
      },
      {
        description: regex
      },
    ];
  }

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
    .populate('actor', 'name email avatar')
    .populate('revisionId', 'revisionNumber workflowStatus')
    .sort({
      createdAt: -1
    })
    .skip(skip)
    .limit(limit)
    .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    logs: logs.map((log) => ({
      id: String(log._id),
      action: log.action,
      description: log.description || '',
      entity: log.entity,
      entityId: log.entityId ? String(log.entityId) : null,
      projectId: log.projectId ? String(log.projectId) : null,
      revisionId: log.revisionId ? String(log.revisionId) : null,
      performerRole: log.performerRole || 'system',
      timestamp: log.createdAt,
      actor: log.actor ? {
        id: String(log.actor._id),
        name: log.actor.name || 'Unknown',
        email: log.actor.email || '',
        avatar: log.actor.avatar || null,
      } : null,
      metadata: log.metadata || {},
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

function formatProject(project) {
  return {
    id: String(project._id),
    projectName: project.projectName || project.name,
    name: project.name,
    description: project.description,

    status: project.status,
    displayStatus: project.displayStatus || project.status,

    progress: project.progress,
    priority: project.priority || "medium",

    // Full SRS Request
    srsRequest: project.srsRequest
      ? {
          id: String(project.srsRequest._id),

          fullName: project.srsRequest.fullName,
          company: project.srsRequest.company,
          email: project.srsRequest.email,
          phone: project.srsRequest.phone,

          projectName: project.srsRequest.projectName,
          projectType: project.srsRequest.projectType,

          summary: project.srsRequest.summary,
          goals: project.srsRequest.goals,
          audience: project.srsRequest.audience,
          features: project.srsRequest.features,
          userRoles: project.srsRequest.userRoles,
          integrations: project.srsRequest.integrations,
          technology: project.srsRequest.technology,
          timeline: project.srsRequest.timeline,
          budget: project.srsRequest.budget,
          notes: project.srsRequest.notes,

          status: project.srsRequest.status,
          adminNote: project.srsRequest.adminNote,

          approvedAt: project.srsRequest.approvedAt,
          freeRevisionUntil: project.srsRequest.freeRevisionUntil,
          latestRevision: project.srsRequest.latestRevision,
          revisionCount: project.srsRequest.revisionCount,

          createdAt: project.srsRequest.createdAt,
          updatedAt: project.srsRequest.updatedAt,
        }
      : null,

    technologyStack: project.technologyStack || [],
    assignedTeam: project.assignedTeam || [],

    estimatedCompletion: project.estimatedCompletion || null,
    actualCompletion: project.actualCompletion || null,

    timeline: project.timeline || [],

    adminNotes: project.adminNotes || "",
    deadline: project.deadline || null,
    budget: project.budget || 0,

    lastUpdated: project.lastUpdated || project.updatedAt,

    workflowMode: project.workflowMode || "normal",
    pausedStatus: project.pausedStatus || null,

    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

module.exports = {
  getStats,
  getProjects,
  getProjectDetails,
  getActivity,
  getProjectActivityLogs,
};