const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middlewares/auth');

// All dashboard routes require authentication
router.get('/stats', authenticate, dashboardController.stats);
router.get('/projects', authenticate, dashboardController.projects);
router.get('/activity', authenticate, dashboardController.activity);

// Project details route (accessible from both dashboard and standalone)
router.get('/projects/:id', authenticate, dashboardController.projectDetails);

module.exports = router;
