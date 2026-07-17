const router = require('express').Router();
const authenticate = require('../middlewares/auth');
const { authorize } = require('../middlewares/admin');
const controller = require('../controllers/admin.controller');
const adminRateLimit = require('../middlewares/adminRateLimit');

router.use(adminRateLimit, authenticate, authorize('admin'));
router.get('/dashboard', controller.dashboard);

router.get('/users', controller.users);
router.get('/users/:id', controller.user);
router.patch('/users/:id', controller.updateUser);
router.delete('/users/:id', controller.removeUser);
router.patch('/users/:id/role', controller.role);
router.patch('/users/:id/status', controller.status);

router.get('/srs', controller.srs);
router.get('/srs/:id', controller.srsOne);
router.patch('/srs/:id', controller.srsUpdate);
router.delete('/srs/:id', controller.srsDelete);

router.get('/projects', controller.resourceList('projects', 'projects'));
router.post('/projects', controller.resourceCreate('projects', 'project'));
router.patch('/projects/:id', controller.resourceUpdate('projects', 'project'));
router.delete('/projects/:id', controller.resourceDelete('projects'));

router.get('/payments', controller.transactions);
router.get('/invoices', controller.transactions);
router.get('/revenue', controller.revenue);
router.post('/payments', controller.resourceCreate('transactions', 'transaction'));
router.get('/portfolio', controller.resourceList('portfolio', 'portfolio'));
router.post('/portfolio', controller.resourceCreate('portfolio', 'item'));
router.patch('/portfolio/:id', controller.resourceUpdate('portfolio', 'item'));
router.delete('/portfolio/:id', controller.resourceDelete('portfolio'));
router.get('/blogs', controller.resourceList('blogs', 'blogs'));
router.post('/blogs', controller.resourceCreate('blogs', 'blog'));
router.patch('/blogs/:id', controller.resourceUpdate('blogs', 'blog'));
router.delete('/blogs/:id', controller.resourceDelete('blogs'));
router.get('/settings', controller.getSettings);
router.patch('/settings', controller.settings);
router.get('/analytics', controller.analytics);
router.get('/notifications', controller.notifications);
router.get('/notifications/summary', controller.notificationSummary);
router.patch('/notifications/:id/read', controller.readNotification);
router.patch('/notifications/read-all', controller.markAllNotificationsRead);
router.get('/activity-logs', controller.logs);

module.exports = router;
