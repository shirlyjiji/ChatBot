const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  allowedAgents: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now },
  apiKey: { type: String, unique: true, sparse: true }, // sparse allows nulls for companies without keys
});

module.exports = mongoose.model('Company', CompanySchema);