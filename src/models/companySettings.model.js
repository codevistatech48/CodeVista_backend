const mongoose = require('mongoose');
module.exports = mongoose.model('CompanySettings', new mongoose.Schema({
  key: { type: String, unique: true, default: 'company' }, data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true }));
