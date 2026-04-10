const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const Company = require('../models/Company');

const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// 1. CREATE an agent
router.post('/create', auth(['admin']), async (req, res) => {
    const { companyId, name, username, password, email, contact, status } = req.body;
    try {
        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: "Company not found" });

        const currentAgentCount = await Agent.countDocuments({ companyId });
        if (currentAgentCount >= company.allowedAgents) {
            return res.status(400).json({ 
                message: `Limit reached. This company is only allowed ${company.allowedAgents} agents.` 
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAgent = new Agent({
            companyId,
            name,
            username,
            password:hashedPassword,
            email,
            contact,
            status
        });
        if (req.user.companyId !== companyId) {
            return res.status(403).json({ message: 'Unauthorized company access' });
          }
        await newAgent.save();
        res.status(201).json(newAgent);
    } catch (err) {
        res.status(500).json({ message: "Error creating agent", error: err.message });
    }
});

// 2. UPDATE an agent (THE MISSING PIECE)
router.put('/:id', auth(['admin']), async (req, res) => {
    const { name, username, password, email, contact, status } = req.body;
    try {
        // Build update object
        const updateData = { name, username, email, contact, status };
        
        // Only update password if a new one is provided
        if (password && password.trim() !== "") {
            updateData.password = password;
        }

        const updatedAgent = await Agent.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true } // returns the updated document
        );

        if (!updatedAgent) return res.status(404).json({ message: "Agent not found" });
        
        res.json(updatedAgent);
    } catch (err) {
        res.status(500).json({ message: "Error updating agent", error: err.message });
    }
});

// 3. GET all agents (For Super Admin)
router.get('/all', async (req, res) => {
    try {
        const agents = await Agent.find().sort({ createdAt: -1 });
        res.json(agents);
    } catch (err) {
        res.status(500).json({ message: "Error fetching all agents" });
    }
});

// 4. GET agents for a specific company
router.get('/company/:companyId', async (req, res) => {
    try {
        const agents = await Agent.find({ companyId: req.params.companyId });
        res.json(agents);
    } catch (err) {
        res.status(500).json({ message: "Error fetching company agents" });
    }
});

// 5. DELETE an agent
router.delete('/:id', auth(['admin']), async (req, res) => {
    try {
        await Agent.findByIdAndDelete(req.params.id);
        res.json({ message: "Agent deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting agent" });
    }
});

module.exports = router;