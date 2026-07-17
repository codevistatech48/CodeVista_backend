const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

const list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listNotifications(req.user._id);
  res.json({ success: true, notifications });
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllNotificationsRead(req.user._id);
  res.json({ success: true, message: 'Notifications marked as read' });
});

module.exports = { list, markAllRead };
