const mongoose = require('mongoose');
const router = require('express').Router();
const Appointment = require('../models/appointment');

/**
 * Get ALL appointments (super admin - all companies)
 */
router.get('/all', async (req, res) => {
    try {
        const appointments = await Appointment.find({});
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get ALL appointments for a specific company (used by Admin Calendar)
 */
router.get('/all/:companyId', async (req, res) => {
    try {
        const appointments = await Appointment.find({
            companyId: new mongoose.Types.ObjectId(req.params.companyId)
        });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;