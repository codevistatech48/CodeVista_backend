const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['planning', 'active', 'completed', 'cancelled'], default: 'planning', index: true },
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  milestones: [{ title: String, dueDate: Date, completed: { type: Boolean, default: false } }],
  progress: { type: Number, min: 0, max: 100, default: 0 },
  deadline: Date,
  budget: { type: Number, min: 0, default: 0 },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
