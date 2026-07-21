const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLog.model');
const AppError = require('../utils/AppError');

/**
 * Create an activity log entry
 */
async function createActivityLog({
  actorId,
  action,
  description = '',
  entity = '',
  entityId = null,
  projectId = null,
  revisionId = null,
  performerRole = 'system',
  metadata = {},
  ipAddress = null,
  userAgent = null,
}) {
  if (!actorId || !action) {
    throw new AppError('actorId and action are required for activity log', 400);
  }

  const log = await ActivityLog.create({
    actor: actorId,
    action,
    description,
    entity,
    entityId,
    projectId,
    revisionId,
    performerRole,
    metadata,
    ipAddress,
    userAgent,
  });

  return log;
}

/**
 * Get activity logs for a project
 */
async function getProjectActivityLogs(projectId, userId, isAdmin = false, query = {}) {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new AppError('Invalid project id', 400);
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // Build filter
  const filter = { projectId };

  // Non-admin users can only see logs for their own projects
  if (!isAdmin) {
    // This will be handled by the controller/service that checks project ownership
  }

  // Apply filters
  if (query.type && query.type !== 'all') {
    const typeMap = {
      'project': ['project'],
      'revision': ['revision'],
      'admin': ['admin'],
      'status': ['project.status_updated', 'revision.status_changed'],
      'developer': ['developer.assigned', 'revision.developer_assigned'],
    };
    const actions = typeMap[query.type] || [query.type];
    filter.action = { $in: actions };
  }

  if (query.search) {
    const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { action: regex },
      { description: regex },
    ];
  }

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate('actor', 'name email avatar')
      .populate('revisionId', 'revisionNumber workflowStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get recent activity across all projects (for admin dashboard)
 */
async function getRecentActivity(userId, isAdmin = false, limit = 50) {
  const filter = {};
  
  if (!isAdmin) {
    // Regular users can only see their own activity
    filter.actor = userId;
  }

  const logs = await ActivityLog.find(filter)
    .populate('actor', 'name email avatar')
    .populate('projectId', 'projectName status')
    .populate('revisionId', 'revisionNumber workflowStatus')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return logs;
}

module.exports = {
  createActivityLog,
  getProjectActivityLogs,
  getRecentActivity,
};