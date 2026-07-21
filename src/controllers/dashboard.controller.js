const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

// ==========================
// Dashboard Stats
// ==========================
const stats = asyncHandler(async (req, res) => {
  const data = await dashboardService.getStats(req.user._id);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// User Projects
// ==========================
const projects = asyncHandler(async (req, res) => {
  const data = await dashboardService.getProjects(req.user._id);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Project Details
// ==========================
const projectDetails = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const data = await dashboardService.getProjectDetails(req.params.id, req.user._id, isAdmin);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Recent Activity
// ==========================
const activity = asyncHandler(async (req, res) => {
  const data = await dashboardService.getActivity(req.user._id);

  res.status(200).json({
    success: true,
    data,
  });
});

// ==========================
// Project Activity Logs
// ==========================
const projectActivity = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const data = await dashboardService.getProjectActivityLogs(req.params.id, req.user._id, isAdmin, req.query);

  res.status(200).json({
    success: true,
    ...data,
  });
});

module.exports = {
  stats,
  projects,
  projectDetails,
  activity,
  projectActivity,
};
