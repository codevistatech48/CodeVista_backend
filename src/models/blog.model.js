const mongoose = require('mongoose');
module.exports = mongoose.model('Blog', new mongoose.Schema({
  title: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true },
  content: { type: String, required: true }, excerpt: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true }, publishedAt: Date,
  isDeleted: { type: Boolean, default: false, index: true }, deletedAt: Date, deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));
