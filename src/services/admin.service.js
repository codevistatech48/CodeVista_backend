const mongoose = require('mongoose');
const User = require('../models/user.model');
const SrsRequest = require('../models/srsRequest.model');
const Project = require('../models/project.model');
const Transaction = require('../models/transaction.model');
const Portfolio = require('../models/portfolio.model');
const Blog = require('../models/blog.model');
const CompanySettings = require('../models/companySettings.model');
const ActivityLog = require('../models/activityLog.model');
const Notification = require('../models/notification.model');
const AppError = require('../utils/AppError');
const { createNotification, notifyAdmins } = require('./notification.service');

const models = { projects: Project, portfolio: Portfolio, blogs: Blog, transactions: Transaction };
const activeSrs = ['pending', 'approved', 'accepted'];

function paging(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function idOrError(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid id', 400);
}

function escapedRegex(value) {
  return new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function dateFilter(query) {
  const filter = {};
  if (query.from && Number.isNaN(new Date(query.from).getTime())) throw new AppError('Invalid from date', 400);
  if (query.to && Number.isNaN(new Date(query.to).getTime())) throw new AppError('Invalid to date', 400);
  if (query.from || query.to) filter.$gte = query.from ? new Date(query.from) : new Date(0);
  if (query.to) filter.$lte = new Date(query.to);
  return Object.keys(filter).length ? { createdAt: filter } : {};
}

function safeSort(query, allowed, fallback = 'createdAt') {
  const field = allowed.includes(query.sortBy) ? query.sortBy : fallback;
  return { [field]: query.order === 'asc' ? 1 : -1 };
}

async function dashboard() {
  const [users, projects, revenue, pendingSrs, completedProjects, monthlyGrowth] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }), Project.countDocuments({ isDeleted: { $ne: true } }), Transaction.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    SrsRequest.countDocuments({ isDeleted: { $ne: true }, status: { $in: activeSrs } }), Project.countDocuments({ isDeleted: { $ne: true }, status: 'completed' }),
    User.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $count: 'users' }]),
  ]);
  return { totalUsers: users, projects, revenue: revenue[0]?.total || 0, pendingSrs, completedProjects, monthlyGrowth: monthlyGrowth[0]?.users || 0 };
}

async function listUsers(query) {
  const { page, limit, skip } = paging(query); const filter = {};
  if (query.search) { const rx = escapedRegex(query.search); filter.$or = [{ name: rx }, { email: rx }]; }
  if (query.role) filter.role = query.role; if (query.status) filter.status = query.status;
  const sort = { [query.sortBy || 'createdAt']: query.order === 'asc' ? 1 : -1 };
  filter.isDeleted = { $ne: true }; Object.assign(filter, dateFilter(query));
  const [items, total] = await Promise.all([User.find(filter).select('-passwordHash').sort(safeSort(query, ['name', 'email', 'role', 'status', 'createdAt', 'updatedAt'])).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  return { items: items.map((user) => ({ ...user, id: String(user._id), _id: undefined })), page, limit, total, pages: Math.ceil(total / limit) };
}

async function getUser(id) { idOrError(id); const user = await User.findOne({ _id: id, isDeleted: { $ne: true } }); if (!user) throw new AppError('User not found', 404); return user.toSafeObject(); }

async function updateUser(id, data, actorId) {
  idOrError(id); const allowed = ['name', 'company', 'location', 'bio', 'website', 'github', 'linkedin'];
  const update = Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, typeof data[key] === 'string' ? data[key].trim() : data[key]]));
  const user = await User.findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { $set: update }, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404); await ActivityLog.create({ actor: actorId, action: 'user.updated', entity: 'User', entityId: user._id }); return user.toSafeObject();
}

async function changeRole(id, role, actorId) { idOrError(id); if (!['user', 'admin', 'project_manager', 'developer'].includes(role)) throw new AppError('Invalid role', 400); const current = await User.findById(id); if (!current) throw new AppError('User not found', 404); if (current.role === 'admin' && role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) throw new AppError('The final administrator cannot be demoted', 409); const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }); await ActivityLog.create({ actor: actorId, action: 'user.role_changed', entity: 'User', entityId: user._id, metadata: { role } }); return user.toSafeObject(); }
async function changeStatus(id, status, actorId) { idOrError(id); if (!['active', 'suspended'].includes(status)) throw new AppError('Invalid user status', 400); const user = await User.findByIdAndUpdate(id, { status }, { new: true }); if (!user) throw new AppError('User not found', 404); await ActivityLog.create({ actor: actorId, action: 'user.status_changed', entity: 'User', entityId: user._id, metadata: { status } }); if (status === 'suspended') await notifyAdmins({ title: 'Unusual account activity', message: `User ${user.email} was suspended.`, type: 'admin_security_alert' }).catch(() => {}); return user.toSafeObject(); }
async function deleteUser(id, actorId) { idOrError(id); if (String(id) === String(actorId)) throw new AppError('You cannot delete your own account', 400); const current = await User.findOne({ _id: id, isDeleted: { $ne: true } }); if (!current) throw new AppError('User not found', 404); if (current.role === 'admin' && await User.countDocuments({ role: 'admin', isDeleted: { $ne: true } }) <= 1) throw new AppError('The final administrator cannot be deleted', 409); await User.updateOne({ _id: id }, { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId } }); await ActivityLog.create({ actor: actorId, action: 'user.deleted', entity: 'User', entityId: id }); }

async function listSrs(query) { const { page, limit, skip } = paging(query); const filter = { isDeleted: { $ne: true }, ...dateFilter(query) }; if (query.status) filter.status = query.status; if (query.search) { const rx = escapedRegex(query.search); filter.$or = [{ projectName: rx }, { company: rx }, { fullName: rx }, { email: rx }]; } const [items, total] = await Promise.all([SrsRequest.find(filter).populate('user', 'name email').populate('assignedDeveloper', 'name email').sort(safeSort(query, ['projectName', 'status', 'createdAt', 'updatedAt'])).skip(skip).limit(limit).lean(), SrsRequest.countDocuments(filter)]); return { items, page, limit, total, pages: Math.ceil(total / limit) }; }
async function getSrs(id) { idOrError(id); const item = await SrsRequest.findById(id).populate('user', 'name email').populate('assignedDeveloper', 'name email'); if (!item) throw new AppError('SRS request not found', 404); return item; }
async function updateSrs(id, data, adminId) { idOrError(id); const allowed = ['status', 'adminNote', 'assignedDeveloper', 'projectName', 'summary']; const update = Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, data[key]])); if (update.status && !['pending', 'approved', 'accepted', 'rejected', 'expired', 'completed'].includes(update.status)) throw new AppError('Invalid SRS status', 400); if (update.assignedDeveloper) { idOrError(update.assignedDeveloper); const developer = await User.findOne({ _id: update.assignedDeveloper, role: 'developer' }); if (!developer) throw new AppError('Assigned user must be a developer', 400); } update.reviewedAt = new Date(); update.reviewedBy = adminId; const request = await SrsRequest.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }); if (!request) throw new AppError('SRS request not found', 404); await ActivityLog.create({ actor: adminId, action: 'srs.updated', entity: 'SrsRequest', entityId: request._id, metadata: update }); if (update.status) await createNotification({ userId: request.user, title: 'SRS request updated', message: `Your SRS request status is now ${update.status}.`, type: 'srs_request_status' }).catch(() => {}); return request; }
async function deleteSrs(id, actorId) { idOrError(id); const request = await SrsRequest.findByIdAndDelete(id); if (!request) throw new AppError('SRS request not found', 404); await ActivityLog.create({ actor: actorId, action: 'srs.deleted', entity: 'SrsRequest', entityId: id }); }

async function listResource(resource, query) { const Model = models[resource]; const { page, limit, skip } = paging(query); const filter = { isDeleted: { $ne: true }, ...dateFilter(query) }; if (resource === 'projects' && query.search) { const rx = escapedRegex(query.search); filter.$or = [{ name: rx }, { description: rx }]; } const [items, total] = await Promise.all([Model.find(filter).sort(safeSort(query, ['name', 'title', 'status', 'createdAt', 'updatedAt'])).skip(skip).limit(limit).lean(), Model.countDocuments(filter)]); return { items, page, limit, total, pages: Math.ceil(total / limit) }; }
async function createResource(resource, data, actorId) { const item = await models[resource].create(data); await ActivityLog.create({ actor: actorId, action: `${resource}.created`, entity: resource, entityId: item._id }); return item; }
async function updateResource(resource, id, data, actorId) { idOrError(id); const item = await models[resource].findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { $set: data }, { new: true, runValidators: true }); if (!item) throw new AppError('Resource not found', 404); await ActivityLog.create({ actor: actorId, action: `${resource}.updated`, entity: resource, entityId: item._id }); return item; }
async function deleteResource(resource, id, actorId) { idOrError(id); const item = await models[resource].findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId } }, { new: true }); if (!item) throw new AppError('Resource not found', 404); await ActivityLog.create({ actor: actorId, action: `${resource}.deleted`, entity: resource, entityId: id }); }

async function transactions(query) { const { page, limit, skip } = paging(query); const filter = query.status ? { status: query.status } : {}; const [items, total] = await Promise.all([Transaction.find(filter).populate('user', 'name email').populate('project', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit), Transaction.countDocuments(filter)]); return { items, page, limit, total, pages: Math.ceil(total / limit) }; }
async function revenue() { const [total, monthlyRevenue] = await Promise.all([Transaction.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]), Transaction.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, amount: { $sum: '$amount' } } }, { $sort: { _id: 1 } }])]); return { totalRevenue: total[0]?.total || 0, monthlyRevenue, currency: 'INR' }; }
async function settings(data, actorId) { const setting = await CompanySettings.findOneAndUpdate({ key: 'company' }, { $set: { data } }, { new: true, upsert: true, runValidators: true }); await ActivityLog.create({ actor: actorId, action: 'settings.changed', entity: 'CompanySettings', entityId: setting._id }); return setting; }
async function getSettings() { return CompanySettings.findOne({ key: 'company' }); }
async function analytics() { const [users, revenueData, projects, completedProjects, srs, totalSrs] = await Promise.all([User.countDocuments(), revenue(), Project.countDocuments(), Project.countDocuments({ status: 'completed' }), SrsRequest.countDocuments({ status: { $in: activeSrs } }), SrsRequest.countDocuments()]); return { users: { total: users }, revenue: revenueData, projects: { total: projects, completed: completedProjects }, srs: { pending: srs, total: totalSrs }, traffic: {} }; }
async function notifications(userId) { return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(100); }
async function markNotification(id, userId) { idOrError(id); const item = await Notification.findOneAndUpdate({ _id: id, user: userId }, { read: true }, { new: true }); if (!item) throw new AppError('Notification not found', 404); return item; }
async function notificationSummary(userId) { const [items, unread] = await Promise.all([notifications(userId), Notification.countDocuments({ user: userId, read: false })]); return { items, unread }; }
async function markAllNotificationsRead(userId) { await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } }); }
async function logs(query) { const { page, limit, skip } = paging(query); const [items, total] = await Promise.all([ActivityLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email'), ActivityLog.countDocuments()]); return { items, page, limit, total, pages: Math.ceil(total / limit) }; }

module.exports = { dashboard, listUsers, getUser, updateUser, changeRole, changeStatus, deleteUser, listSrs, getSrs, updateSrs, deleteSrs, listResource, createResource, updateResource, deleteResource, transactions, revenue, settings, getSettings, analytics, notifications, notificationSummary, markNotification, markAllNotificationsRead, logs };
