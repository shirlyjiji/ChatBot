const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  companyId: mongoose.Schema.Types.ObjectId,
  conversationId: mongoose.Schema.Types.ObjectId,
  nodeId: String,
  question: String,
  answer: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', schema);
