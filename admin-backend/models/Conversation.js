const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: String, // bot | user | agent
    text: String,
    agentName: String,
    createdAt: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    flowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flow' },
    currentNodeId: String,
    guestName: String,
    guestEmail: String,

    status: {
        type: String,
        enum: ['bot', 'waiting_for_agent', 'live', 'closed', 'ended'],
        default: 'bot'
    },

    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        default: null
    },

    endedBy: {
        type: String,
        enum: ['user', 'agent', 'system'],
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    },

    messages: [messageSchema],

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', conversationSchema);
