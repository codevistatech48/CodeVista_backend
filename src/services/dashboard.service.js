const mongoose = require('mongoose');
const SrsRequest = require('../models/srsRequest.model');
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

  return projects.map(formatProject);
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

  return formatProject(project);
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

function formatProject(project) {
  return {
    id: String(project._id),
    projectName: project.projectName || project.name,
    name: project.name,
    description: project.description,
    status: project.status,
    progress: project.progress,
    priority: project.priority || 'medium',
    technologyStack: project.technologyStack || [],
    assignedTeam: project.assignedTeam || [],
    estimatedCompletion: project.estimatedCompletion || null,
    actualCompletion: project.actualCompletion || null,
    timeline: project.timeline || [],
    adminNotes: project.adminNotes || '',
    deadline: project.deadline || null,
    budget: project.budget || 0,
    lastUpdated: project.lastUpdated || project.updatedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,

    srsRequest: project.srsRequest ?
      {
        id: String(project.srsRequest._id),

        projectName: project.srsRequest.projectName || '',
        summary: project.srsRequest.summary || '',
        technology: project.srsRequest.technology || '',
        status: project.srsRequest.status || '',
        fullName: project.srsRequest.fullName || '',
        company: project.srsRequest.company || '',
        email: project.srsRequest.email || '',
        phone: project.srsRequest.phone || '',

        // Existing schema fields
        goals: project.srsRequest.goals || '',
        audience: project.srsRequest.audience || '',
        features: project.srsRequest.features || '',
        userRoles: project.srsRequest.userRoles || '',
        integrations: project.srsRequest.integrations || '',
        timeline: project.srsRequest.timeline || '',
        budget: project.srsRequest.budget || '',
        notes: project.srsRequest.notes || '',

        // Aliases for frontend
        businessGoals: project.srsRequest.goals || '',
        targetUsers: project.srsRequest.audience || '',
        keyFeatures: project.srsRequest.features || '',
        technologyRequirements: project.srsRequest.technology || '',
        targetTimeline: project.srsRequest.timeline || '',
        budgetRange: project.srsRequest.budget || '',
        additionalNotes: project.srsRequest.notes || '',

        approvedAt: project.srsRequest.approvedAt || null,
        freeRevisionUntil: project.srsRequest.freeRevisionUntil || null,
        latestRevision: project.srsRequest.latestRevision || 0,
        revisionCount: project.srsRequest.revisionCount || 0,
        adminNote: project.srsRequest.adminNote || '',
        reviewedAt: project.srsRequest.reviewedAt || null,
      } :
      null,

    user: project.user ?
      {
        id: String(project.user._id || project.user),
        name: project.user.name || '',
        email: project.user.email || '',
        photoURL: project.user.photoURL || null,
      } :
      null,
  };
}
module.exports = {
  getStats,
  getProjects,
  getProjectDetails,
  getActivity,
};