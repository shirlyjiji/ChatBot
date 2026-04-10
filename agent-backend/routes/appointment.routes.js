const mongoose = require('mongoose');
const router = require('express').Router();
const Appointment = require('../models/Appointment');

/**
 * Get booked slots for a specific day (used by the chatbot)
 */
router.get('/slots', async (req, res) => {
  const { companyId, date } = req.query;
   const booked = await Appointment.find({ companyId, date });
  res.json(booked.map(a => a.time));
   
  // try {
  //   const { companyId, date } = req.query;
 
  //   if (!companyId || !date) {
  //     return res.status(400).json({ message: "Missing companyId or date" });
  //   }

  //   // Convert string ID to ObjectId to ensure MongoDB finds it
  //   const query = {
  //     companyId: new mongoose.Types.ObjectId(companyId),
  //     date: date
  //   };

  //   const booked = await Appointment.find(query);
  //   res.json(booked.map(a => a.time));
  // } catch (err) {
  //   res.status(500).json({ error: err.message });
  // }
});




/**
 * Save appointment
 */
router.post('/book', async (req, res) => {
  const { companyId, conversationId, date, time } = req.body;

  const exists = await Appointment.findOne({ companyId, date, time });
  if (exists) {
    return res.status(409).json({ message: 'Slot already booked' });
  }

  const appt = await Appointment.create({
    companyId,
    conversationId,
    date,
    time
  });

  res.json(appt);
});

module.exports = router;
