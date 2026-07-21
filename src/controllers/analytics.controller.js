const asyncHandler = require('../utils/asyncHandler');
const analyticsService = require('../services/analytics.service');

// ==========================
// Admin Analytics
// ==========================
const adminAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAdminAnalytics(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Chart Data Endpoints
// ==========================
const monthlyProjects = asyncHandler(async (req, res) => {
  const data = await analyticsService.getMonthlyProjectsCreated(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const projectStatusDistribution = asyncHandler(async (req, res) => {
  const data = await analyticsService.getProjectStatusDistribution(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const revisionStatusDistribution = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRevisionStatusDistribution(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const srsRequestTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSrsRequestTrend(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const projectCompletionTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getProjectCompletionTrend(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const revisionApprovalVsRejection = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRevisionApprovalVsRejection(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const developerWorkload = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDeveloperWorkload(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const activityHeatmap = asyncHandler(async (req, res) => {
  const data = await analyticsService.getActivityHeatmap(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Developer Analytics
// ==========================
const developerAnalytics = asyncHandler(async (req, res) => {
  const developerId = req.params.developerId || req.user._id;
  const data = await analyticsService.getDeveloperAnalytics(developerId, req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// User Analytics
// ==========================
const userAnalytics = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.user._id;
  const data = await analyticsService.getUserAnalytics(userId, req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Project Insights
// ==========================
const projectInsights = asyncHandler(async (req, res) => {
  const data = await analyticsService.getProjectInsights(req.params.projectId);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Recent Activities
// ==========================
const recentActivities = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const data = await analyticsService.getRecentActivities(limit);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Export Analytics
// ==========================
const exportAnalytics = asyncHandler(async (req, res) => {
  const format = req.query.format || 'json';
  const data = await analyticsService.exportAnalytics(format, req.query);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
    return res.send(data.data);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
  res.json(data.data);
});

module.exports = {
  adminAnalytics,
  monthlyProjects,
  projectStatusDistribution,
  revisionStatusDistribution,
  srsRequestTrend,
  projectCompletionTrend,
  revisionApprovalVsRejection,
  developerWorkload,
  activityHeatmap,
  developerAnalytics,
  userAnalytics,
  projectInsights,
  recentActivities,
  exportAnalytics,
};