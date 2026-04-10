const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');

// GET all conversations for the company
router.get('/', auth(), async (req, res) => {
    try {
        const { companyId, role } = req.user;

        // Super-admin might want to see everything? 
        // For now, let's stick to the companyId from user. 
        // If super-admin, we might need a way to filter by companyId from query.
        let filter = { companyId: companyId };

        if (role === 'super_admin') {
            // If super-admin wants all chats or specific company chats
            if (req.query.companyId && req.query.companyId !== 'null') {
                filter.companyId = req.query.companyId;
            } else {
                filter = {}; // All chats? Maybe too many.
            }
        }

        const conversations = await Conversation.find(filter)
            .populate('agentId', 'username') // To show agent name
            .sort({ createdAt: -1 });

        res.json(conversations);
    } catch (err) {
        console.error("Fetch Chats Error:", err);
        res.status(500).json({ message: "Error fetching chat history" });
    }
});

// GET specific conversation by ID
router.get('/:id', auth(), async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('agentId', 'username');

        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        // Authorization check
        if (req.user.role !== 'super_admin' && conversation.companyId.toString() !== req.user.companyId.toString()) {
            return res.status(403).json({ message: "Forbidden" });
        }

        res.json(conversation);
    } catch (err) {
        res.status(500).json({ message: "Error fetching conversation" });
    }
});

module.exports = router;
