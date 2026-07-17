const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { getSocketServer } = require('../utils/socket');

async function createNotification({ userId, title, message, type = 'general' }) {
  const notification = await Notification.create({ user: userId, title, message, type });
  const io = getSocketServer();

  if (io) {
    io.to(String(userId)).emit('notification:new', toNotificationPayload(notification));
  }

  return notification;
}

async function listNotifications(userId) {
  const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean();
  return notifications.map(toNotificationPayload);
}

function toNotificationPayload(notification) {
  return {
    id: String(notification._id || notification.id),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

async function markAllNotificationsRead(userId) {
  await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
}

async function notifyAdmins({ title, message, type = 'admin_alert' }) {
  const admins = await User.find({ role: 'admin', status: 'active', isDeleted: { $ne: true } }).select('_id').lean();
  await Promise.all(admins.map((admin) => createNotification({ userId: admin._id, title, message, type })));
}

module.exports = { createNotification, notifyAdmins, listNotifications, markAllNotificationsRead };
