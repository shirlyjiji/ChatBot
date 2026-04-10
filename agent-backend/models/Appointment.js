const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  companyId: mongoose.Schema.Types.ObjectId,
  conversationId: mongoose.Schema.Types.ObjectId,
  date: String, // YYYY-MM-DD
  time: String, // HH:mm
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
