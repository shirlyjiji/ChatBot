const mongoose = require('mongoose');

const FlowSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: String }, // Username of Admin or Agent
  name: { type: String, default: "Untitled Flow" },
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true },
  viewport: { type: Object },
  lastSaved: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Flow', FlowSchema);