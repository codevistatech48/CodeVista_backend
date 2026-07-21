const mongoose = require('mongoose');
const Project = require('../models/project.model');
const SrsRequest = require('../models/srsRequest.model');
const SrsRevision = require('../models/srsRevision.model');
const ActivityLog = require('../models/activityLog.model');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');

/**
 * Get date range from query parameters
 */
function getDateRange(query) {
  const now = new Date();
  let startDate;

  if (query.from && query.to) {
    startDate = new Date(query.from);
    const endDate = new Date(query.to);
    return { startDate, endDate };
  }

  switch (query.period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'today':
    default:
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
  }

  return { startDate, endDate: new Date() };
}

/**
 * Get admin analytics overview
 */
async function getAdminAnalytics(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const dateFilter = {
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  const [
    totalProjects,
    activeProjects,
    projectsInRevision,
    completedProjects,
    pendingSrs,
    activeDevelopers,
    completedRevisions,
    rejectedRevisions,
    totalRevisions,
    avgCompletionTime,
    avgRevisionCount,
  ] = await Promise.all([
    // Total projects
    Project.countDocuments({ ...dateFilter, isDeleted: { $ne: true } }),

    // Active projects (planning, ui_design, development, testing, deployment, active)
    Project.countDocuments({
      ...dateFilter,
      status: { $in: ['planning', 'ui_design', 'development', 'testing', 'deployment', 'active'] },
      isDeleted: { $ne: true },
    }),

    // Projects in revision
    Project.countDocuments({
      ...dateFilter,
      workflowMode: 'revision',
      isDeleted: { $ne: true },
    }),

    // Completed projects
    Project.countDocuments({
      ...dateFilter,
      status: 'completed',
      isDeleted: { $ne: true },
    }),

    // Pending SRS
    SrsRequest.countDocuments({
      ...dateFilter,
      status: 'pending',
      isDeleted: { $ne: true },
    }),

    // Active developers (users with role developer who have assigned projects)
    User.countDocuments({
      role: 'developer',
      status: 'active',
      isDeleted: { $ne: true },
    }),

    // Completed revisions
    SrsRevision.countDocuments({
      ...dateFilter,
      workflowStatus: 'merged',
    }),

    // Rejected revisions
    SrsRevision.countDocuments({
      ...dateFilter,
      workflowStatus: 'rejected',
    }),

    // Total revisions
    SrsRevision.countDocuments({
      ...dateFilter,
    }),

    // Average project completion time (days from created to completed)
    Project.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: {
            $avg: {
              $divide: [
                { $subtract: ['$updatedAt', '$createdAt'] },
                1000 * 60 * 60 * 24, // Convert to days
              ],
            },
          },
        },
      },
    ]),

    // Average revision count per project
    Project.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: 'srsrevisions',
          localField: 'srsRequest',
          foreignField: 'originalSrs',
          as: 'revisions',
        },
      },
      {
        $group: {
          _id: null,
          avgRevisions: {
            $avg: { $size: '$revisions' },
          },
        },
      },
    ]),
  ]);

  const approvalRate = totalRevisions > 0 ? ((completedRevisions / totalRevisions) * 100).toFixed(1) : 0;

  return {
    overview: {
      totalProjects,
      activeProjects,
      projectsInRevision,
      completedProjects,
      pendingSrs,
      activeDevelopers,
      completedRevisions,
      rejectedRevisions,
      revisionApprovalRate: `${approvalRate}%`,
      avgCompletionTime: avgCompletionTime[0] ? `${avgCompletionTime[0].avgDays.toFixed(1)} days` : 'N/A',
      avgRevisionCount: avgRevisionCount[0] ? avgRevisionCount[0].avgRevisions.toFixed(1) : '0',
    },
  };
}

/**
 * Get monthly projects created chart data
 */
async function getMonthlyProjectsCreated(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await Project.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
    {
      $project: {
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' },
              ],
            },
          ],
        },
        count: 1,
      },
    },
  ]);

  return data;
}

/**
 * Get project status distribution
 */
async function getProjectStatusDistribution(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await Project.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  return data.map((item) => ({
    name: item._id,
    value: item.count,
  }));
}

/**
 * Get revision status distribution
 */
async function getRevisionStatusDistribution(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await SrsRevision.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$workflowStatus',
        count: { $sum: 1 },
      },
    },
  ]);

  return data.map((item) => ({
    name: item._id,
    value: item.count,
  }));
}

/**
 * Get SRS request trend
 */
async function getSrsRequestTrend(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await SrsRequest.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
    },
    {
      $project: {
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' },
              ],
            },
            '-',
            {
              $cond: [
                { $lt: ['$_id.day', 10] },
                { $concat: ['0', { $toString: '$_id.day' }] },
                { $toString: '$_id.day' },
              ],
            },
          ],
        },
        count: 1,
      },
    },
  ]);

  return data;
}

/**
 * Get project completion trend
 */
async function getProjectCompletionTrend(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await Project.aggregate([
    {
      $match: {
        status: 'completed',
        updatedAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$updatedAt' },
          month: { $month: '$updatedAt' },
          day: { $dayOfMonth: '$updatedAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
    },
    {
      $project: {
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' },
              ],
            },
            '-',
            {
              $cond: [
                { $lt: ['$_id.day', 10] },
                { $concat: ['0', { $toString: '$_id.day' }] },
                { $toString: '$_id.day' },
              ],
            },
          ],
        },
        count: 1,
      },
    },
  ]);

  return data;
}

/**
 * Get revision approval vs rejection
 */
async function getRevisionApprovalVsRejection(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const [approved, rejected] = await Promise.all([
    SrsRevision.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      workflowStatus: 'merged',
    }),
    SrsRevision.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      workflowStatus: 'rejected',
    }),
  ]);

  return [
    { name: 'Approved', value: approved },
    { name: 'Rejected', value: rejected },
  ];
}

/**
 * Get developer workload
 */
async function getDeveloperWorkload(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await SrsRevision.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        assignedDeveloper: { $ne: null },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedDeveloper',
        foreignField: '_id',
        as: 'developer',
      },
    },
    {
      $unwind: '$developer',
    },
    {
      $group: {
        _id: '$assignedDeveloper',
        developerName: { $first: '$developer.name' },
        totalRevisions: { $sum: 1 },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$workflowStatus', 'merged'] }, 1, 0],
          },
        },
        inProgress: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$workflowStatus',
                  ['approved', 'revision_development', 'revision_testing', 'revision_completed', 'ready_for_merge'],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: { totalRevisions: -1 },
    },
  ]);

  return data.map((item) => ({
    name: item.developerName || 'Unknown',
    total: item.totalRevisions,
    completed: item.completed,
    inProgress: item.inProgress,
  }));
}

/**
 * Get activity heatmap (timeline activity)
 */
async function getActivityHeatmap(query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const data = await ActivityLog.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
    },
    {
      $project: {
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' },
              ],
            },
            '-',
            {
              $cond: [
                { $lt: ['$_id.day', 10] },
                { $concat: ['0', { $toString: '$_id.day' }] },
                { $toString: '$_id.day' },
              ],
            },
          ],
        },
        count: 1,
      },
    },
  ]);

  return data;
}

/**
 * Get developer analytics
 */
async function getDeveloperAnalytics(developerId, query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const dateFilter = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [
    assignedProjects,
    completedTasks,
    projectsInTesting,
    projectsInRevision,
    avgCompletionTime,
  ] = await Promise.all([
    // Assigned projects (revisions assigned to developer)
    SrsRevision.countDocuments({
      ...dateFilter,
      assignedDeveloper: developerId,
    }),

    // Completed tasks (merged revisions)
    SrsRevision.countDocuments({
      ...dateFilter,
      assignedDeveloper: developerId,
      workflowStatus: 'merged',
    }),

    // Projects in testing
    SrsRevision.countDocuments({
      ...dateFilter,
      assignedDeveloper: developerId,
      workflowStatus: 'revision_testing',
    }),

    // Projects in revision
    SrsRevision.countDocuments({
      ...dateFilter,
      assignedDeveloper: developerId,
      workflowStatus: { $ne: 'merged' },
    }),

    // Average completion time for developer's tasks
    SrsRevision.aggregate([
      {
        $match: {
          assignedDeveloper: developerId,
          workflowStatus: 'merged',
          mergedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: {
            $avg: {
              $divide: [
                { $subtract: ['$mergedAt', '$createdAt'] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
    ]),
  ]);

  return {
    assignedProjects,
    completedTasks,
    projectsInTesting,
    projectsInRevision,
    avgCompletionTime: avgCompletionTime[0] ? `${avgCompletionTime[0].avgDays.toFixed(1)} days` : 'N/A',
  };
}

/**
 * Get user analytics
 */
async function getUserAnalytics(userId, query = {}) {
  const { startDate, endDate } = getDateRange(query);

  const dateFilter = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [
    totalProjects,
    completedProjects,
    projectsInProgress,
    pendingRevisions,
    totalRevisionsSubmitted,
  ] = await Promise.all([
    // Total projects
    Project.countDocuments({
      ...dateFilter,
      user: userId,
      isDeleted: { $ne: true },
    }),

    // Completed projects
    Project.countDocuments({
      ...dateFilter,
      user: userId,
      status: 'completed',
      isDeleted: { $ne: true },
    }),

    // Projects in progress
    Project.countDocuments({
      ...dateFilter,
      user: userId,
      status: { $in: ['planning', 'ui_design', 'development', 'testing', 'deployment', 'active'] },
      isDeleted: { $ne: true },
    }),

    // Pending revisions (user's SRS requests with active revisions)
    SrsRequest.countDocuments({
      ...dateFilter,
      user: userId,
      latestRevision: { $gt: 0 },
    }),

    // Total revisions submitted
    SrsRevision.countDocuments({
      ...dateFilter,
      createdBy: userId,
    }),
  ]);

  return {
    totalProjects,
    completedProjects,
    projectsInProgress,
    pendingRevisions,
    totalRevisionsSubmitted,
  };
}

/**
 * Get project insights
 */
async function getProjectInsights(projectId) {
  const project = await Project.findById(projectId)
    .populate('srsRequest', 'projectName latestRevision revisionCount')
    .populate('assignedTeam', 'name email')
    .lean();

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Calculate estimated remaining days
  let estimatedRemainingDays = 'N/A';
  if (project.estimatedCompletion && project.status !== 'completed') {
    const now = new Date();
    const remaining = Math.ceil((new Date(project.estimatedCompletion) - now) / (1000 * 60 * 60 * 24));
    estimatedRemainingDays = remaining > 0 ? `${remaining} days` : 'Overdue';
  }

  // Determine risk level
  let riskLevel = 'green';
  const progress = project.progress || 0;
  if (progress < 30 && project.status !== 'planning') {
    riskLevel = 'red';
  } else if (progress < 60) {
    riskLevel = 'yellow';
  }

  // Get current developer
  const currentDeveloper = project.assignedTeam?.[0]?.name || 'Unassigned';

  return {
    projectId: project._id,
    projectName: project.projectName || project.name,
    completionPercentage: progress,
    estimatedRemainingDays,
    revisionCount: project.srsRequest?.revisionCount || 0,
    currentPhase: project.status,
    currentDeveloper,
    riskLevel,
  };
}

/**
 * Get recent activities
 */
async function getRecentActivities(limit = 20) {
  const activities = await ActivityLog.find()
    .populate('actor', 'name email')
    .populate('projectId', 'projectName')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return activities.map((activity) => ({
    id: activity._id,
    action: activity.action,
    description: activity.description,
    actor: activity.actor ? {
      name: activity.actor.name || 'Unknown',
      email: activity.actor.email,
    } : null,
    project: activity.projectId ? {
      name: activity.projectId.projectName || 'Unknown',
    } : null,
    timestamp: activity.createdAt,
    performerRole: activity.performerRole,
  }));
}

/**
 * Export analytics data
 */
async function exportAnalytics(format, query = {}) {
  const { startDate, endDate } = getDateRange(query);

  // Get all analytics data
  const [
    adminAnalytics,
    monthlyProjects,
    statusDistribution,
    revisionDistribution,
    srsTrend,
    completionTrend,
    approvalVsRejection,
    developerWorkload,
    activityHeatmap,
  ] = await Promise.all([
    getAdminAnalytics(query),
    getMonthlyProjectsCreated(query),
    getProjectStatusDistribution(query),
    getRevisionStatusDistribution(query),
    getSrsRequestTrend(query),
    getProjectCompletionTrend(query),
    getRevisionApprovalVsRejection(query),
    getDeveloperWorkload(query),
    getActivityHeatmap(query),
  ]);

  const exportData = {
    generatedAt: new Date(),
    period: { startDate, endDate },
    adminAnalytics,
    charts: {
      monthlyProjects,
      statusDistribution,
      revisionDistribution,
      srsTrend,
      completionTrend,
      approvalVsRejection,
      developerWorkload,
      activityHeatmap,
    },
  };

  if (format === 'csv') {
    // Convert to CSV format
    const csvRows = [];
    csvRows.push(['Metric', 'Value']);

    // Add overview metrics
    Object.entries(adminAnalytics.overview).forEach(([key, value]) => {
      csvRows.push([key, value]);
    });

    // Add chart data
    csvRows.push([]);
    csvRows.push(['Chart', 'Data']);
    csvRows.push(['Monthly Projects', JSON.stringify(monthlyProjects)]);
    csvRows.push(['Status Distribution', JSON.stringify(statusDistribution)]);
    csvRows.push(['Revision Distribution', JSON.stringify(revisionDistribution)]);

    return {
      format: 'csv',
      data: csvRows.map((row) => row.join(',')).join('\n'),
      filename: `analytics_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`,
    };
  }

  // Default to JSON (PDF would require additional library)
  return {
    format: 'json',
    data: exportData,
    filename: `analytics_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.json`,
  };
}

module.exports = {
  getAdminAnalytics,
  getMonthlyProjectsCreated,
  getProjectStatusDistribution,
  getRevisionStatusDistribution,
  getSrsRequestTrend,
  getProjectCompletionTrend,
  getRevisionApprovalVsRejection,
  getDeveloperWorkload,
  getActivityHeatmap,
  getDeveloperAnalytics,
  getUserAnalytics,
  getProjectInsights,
  getRecentActivities,
  exportAnalytics,
};