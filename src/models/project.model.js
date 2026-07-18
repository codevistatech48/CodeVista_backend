const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Existing fields (preserved)
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'cancelled', 'ui_design', 'development', 'testing', 'deployment'],
    default: 'planning',
    index: true,
  },
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  milestones: [{ title: String, dueDate: Date, completed: { type: Boolean, default: false } }],
  progress: { type: Number, min: 0, max: 100, default: 0 },
  deadline: Date,
  budget: { type: Number, min: 0, default: 0 },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // New fields for dashboard features
  srsRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'SrsRequest', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  projectName: { type: String, default: '', trim: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  technologyStack: [{ type: String, trim: true }],
  assignedTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  estimatedCompletion: { type: Date, default: null },
  actualCompletion: { type: Date, default: null },
  timeline: [{
    stage: { type: String, enum: ['accepted', 'planning', 'ui_design', 'development', 'testing', 'deployment', 'completed'] },
    status: { type: String, enum: ['pending', 'completed', 'in_progress'], default: 'pending' },
    date: { type: Date, default: Date.now },
  }],
  adminNotes: { type: String, default: '', trim: true, maxlength: 5000 },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

// Index for faster user-scoped queries
projectSchema.index({ user: 1, isDeleted: 1 });
projectSchema.index({ srsRequest: 1 });

module.exports = mongoose.model('Project', projectSchema);