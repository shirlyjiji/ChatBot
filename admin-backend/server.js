require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


// Import Routes
const flowRoutes = require('./routes/flowRoutes');
const companyRoutes = require('./routes/companyRoutes'); // New
const agentRoutes = require('./routes/agentRoutes');   // New
const authRoutes = require('./routes/authRoutes');     // Fixed
const appointmentRoutes = require('./routes/appointmentRoutes'); // Fixed
const chatRoutes = require('./routes/chatRoutes');
const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chats', chatRoutes);



// Global Stats Route (for Dashboard)
// Super Admin Stats
app.get('/api/super/stats', async (req, res) => {
    try {
        const Company = require('./models/Company');
        const Agent = require('./models/Agent');
        const companyCount = await Company.countDocuments();
        const agentCount = await Agent.countDocuments();
        res.json({ companyCount, agentCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Company Stats
app.get('/api/companies/:id/stats', async (req, res) => {
    try {
        const Company = require('./models/Company');
        const Agent = require('./models/Agent');
        const Flow = require('./models/Flow');

        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        const currentAgents = await Agent.countDocuments({ companyId: req.params.id });
        const flowCount = await Flow.countDocuments({ companyId: req.params.id });

        res.json({
            currentAgents,
            allowedAgents: company.allowedAgents,
            flowCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy aliases (optional, keeping for compatibility if needed elsewhere)
app.get('/api/stats/super', (req, res) => res.redirect(301, '/api/super/stats'));
app.get('/api/stats/company/:id', (req, res) => res.redirect(301, `/api/companies/${req.params.id}/stats`));

// Database Connection
const MONGO_OPTIONS = {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    heartbeatFrequencyMS: 10000,
    socketTimeoutMS: 45000,
};

mongoose.connection.on('connected', () => console.log('✅ Mongoose connected to DB'));
mongoose.connection.on('error', (err) => console.error('❌ Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongoose disconnected'));

mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS)
    .then(() => console.log('✅ MongoDB Initialized successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));