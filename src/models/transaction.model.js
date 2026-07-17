const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  invoiceNumber: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
  paidAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
