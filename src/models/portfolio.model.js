const mongoose = require('mongoose');
module.exports = mongoose.model('Portfolio', new mongoose.Schema({
  title: { type: String, required: true, trim: true }, description: { type: String, default: '' },
  images: [String], technology: [String], published: { type: Boolean, default: false, index: true },
  isDeleted: { type: Boolean, default: false, index: true }, deletedAt: Date, deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));
