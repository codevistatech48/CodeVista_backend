const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/admin');

// All analytics routes require authentication
router.use(authenticate);

// ==========================
// Admin Analytics
// ==========================
router.get('/admin/overview', authorize, analyticsController.adminAnalytics);
router.get('/admin/monthly-projects', authorize, analyticsController.monthlyProjects);
router.get('/admin/project-status', authorize, analyticsController.projectStatusDistribution);
router.get('/admin/revision-status', authorize, analyticsController.revisionStatusDistribution);
router.get('/admin/srs-trend', authorize, analyticsController.srsRequestTrend);
router.get('/admin/completion-trend', authorize, analyticsController.projectCompletionTrend);
router.get('/admin/revision-approval', authorize, analyticsController.revisionApprovalVsRejection);
router.get('/admin/developer-workload', authorize, analyticsController.developerWorkload);
router.get('/admin/activity-heatmap', authorize, analyticsController.activityHeatmap);

// ==========================
// Developer Analytics
// ==========================
router.get('/developer', authorize, analyticsController.developerAnalytics);
router.get('/developer/:developerId', authorize, analyticsController.developerAnalytics);

// ==========================
// User Analytics
// ==========================
router.get('/user', analyticsController.userAnalytics);
router.get('/user/:userId', analyticsController.userAnalytics);

// ==========================
// Project Insights
// ==========================
router.get('/project/:projectId', analyticsController.projectInsights);

// ==========================
// Recent Activities
// ==========================
router.get('/recent-activities', analyticsController.recentActivities);

// ==========================
// Export Analytics
// ==========================
router.get('/export', authorize, analyticsController.exportAnalytics);

module.exports = router;