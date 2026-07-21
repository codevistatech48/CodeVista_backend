const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  actor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true 
  },
  action: { 
    type: String, 
    required: true,
    index: true
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  },
  entity: { 
    type: String, 
    index: true 
  },
  entityId: mongoose.Schema.Types.ObjectId,
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  revisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SrsRevision',
    index: true,
    default: null
  },
  performerRole: {
    type: String,
    enum: ['user', 'admin', 'developer', 'system'],
    default: 'system'
  },
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String, 
  userAgent: String,
}, { timestamps: true });

// Compound indexes for efficient queries
activityLogSchema.index({ projectId: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ actor: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);