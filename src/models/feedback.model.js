const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['new', 'reviewed'], default: 'new' },
    submittedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'Feedback',
  }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
