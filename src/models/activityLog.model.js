const mongoose = require('mongoose');
module.exports = mongoose.model('ActivityLog', new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, action: { type: String, required: true },
  entity: String, entityId: mongoose.Schema.Types.ObjectId, metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String, userAgent: String,
}, { timestamps: true }));
