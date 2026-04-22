const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
const Conversation = require('./models/Conversation');
const jwt = require('jsonwebtoken');
const Agent = require('./models/Agent');


const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Agent Backend is running' });
});

// Connection Options
const MONGO_OPTIONS = {
  family: 4,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  socketTimeoutMS: 45000,
};

// Connection Monitoring
mongoose.connection.on('connected', () => console.log('✅ Mongoose connected to DB'));
mongoose.connection.on('error', (err) => console.error('❌ Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongoose disconnected'));
mongoose.connection.on('reconnected', () => console.log('🔄 Mongoose reconnected'));

mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS)
  .then(async () => {
    console.log(`🚀 Connected to database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
    const Flow = require('./models/Flow');
    const Company = require('./models/Company');
    try {
      const flows = await Flow.find({});
      console.log(`Startup diagnostic: Total flows found: ${flows.length}`);
      const companies = await Company.find({});
      console.log(`Startup diagnostic: Total companies found: ${companies.length}`);
    } catch (err) {
      console.error('Startup diagnostic failed:', err.message);
    }
  })
  .catch(err => {
    console.error('❌ MongoDB Initial Connection Error:', err);
  });


app.use('/api/conversations', require('./routes/conversation.routes'));
app.use('/api/agents', require('./routes/agent.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.SOCKET_CORS_ORIGIN } });
app.set('io', io);

// ================= SOCKET SETUP =================
// Track which agent socket is handling each call: conversationId -> agentSocketId
const callAgentMap = new Map();


// ---- USER SOCKET (NO JWT) ----
io.on('connection', (socket) => {
  console.log('User socket connected', socket.id);

  socket.on('joinConversation', (conversationId) => {
    if (!conversationId) return;
    socket.join(conversationId);
  });

  socket.on('userMessage', async ({ conversationId, text }) => {
    try {
      if (!text || !conversationId) return;

      const convo = await Conversation.findById(conversationId);
      if (!convo) return;

      // ✅ allow waiting + active
      // if (!['waiting_for_agent', 'active'].includes(convo.status)) return;

      const msg = { from: 'user', text, createdAt: new Date() };
      convo.messages.push(msg);
      await convo.save();

      // emit to user + agent rooms
      io.to(conversationId).emit('message', msg);
      agentIO.to(conversationId).emit('message', msg);
    } catch (e) {
      console.error('userMessage error:', e);
    }
  });

  socket.on('endChat', async ({ conversationId, endedBy }) => {
    try {
      const convo = await Conversation.findById(conversationId);
      if (!convo) return;

      convo.status = 'ended';
      convo.endedBy = endedBy;
      convo.endedAt = new Date();

      convo.messages.push({ from: 'bot', text: 'Chat ended. Thank you!', createdAt: new Date() });
      await convo.save();

      io.to(conversationId).emit('chatEnded', { endedBy });
      agentIO.to(conversationId).emit('chatEnded', { endedBy });
    } catch (e) {
      console.error('endChat error:', e);
    }
  });

  socket.on('requestAudioCall', async ({ conversationId }) => {
    console.log('User requesting audio call in convo:', conversationId);
    try {
      const convo = await Conversation.findById(conversationId);
      if (!convo) return;
      // Broadcast to ALL connected agents of this company (not just those in the convo room)
      // This ensures agent receives the call even before they've accepted any chat
      agentIO.emit('incomingAudioCall', { conversationId, companyId: convo.companyId.toString() });
      // Also ensure user's socket has joined the conversation room for WebRTC signaling later
      socket.join(conversationId);
    } catch (e) {
      console.error('requestAudioCall error:', e);
    }
  });

  // WebRTC signaling — user → agent
  socket.on('webrtc-offer', ({ conversationId, offer }) => {
    const agentSocketId = callAgentMap.get(conversationId);
    console.log(`[Signaling] Forwarding webrtc-offer to agent. ConvoID: ${conversationId}, AgentSocketId: ${agentSocketId}`);
    if (agentSocketId) {
      // Direct emission to the specific accepting agent socket
      agentIO.to(agentSocketId).emit('webrtc-offer', { conversationId, offer });
    } else {
      // Fallback: broadcast to room
      agentIO.to(conversationId).emit('webrtc-offer', { conversationId, offer });
    }
  });

  socket.on('webrtc-ice-candidate', ({ conversationId, candidate }) => {
    const agentSocketId = callAgentMap.get(conversationId);
    console.log(`[Signaling] Forwarding ICE candidate (User→Agent) ConvoID: ${conversationId}, AgentSocketId: ${agentSocketId}`);
    if (agentSocketId) {
      agentIO.to(agentSocketId).emit('webrtc-ice-candidate', { conversationId, candidate });
    } else {
      agentIO.to(conversationId).emit('webrtc-ice-candidate', { conversationId, candidate });
    }
  });



  socket.on('endAudioCall', ({ conversationId }) => {
    agentIO.to(conversationId).emit('audioCallEnded', { conversationId });
    io.to(conversationId).emit('audioCallEnded', { conversationId });
    // Clean up agent tracking
    callAgentMap.delete(conversationId);
  });
});


// ---- AGENT SOCKET (JWT PROTECTED) ----
const agentIO = io.of('/agent');

agentIO.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing token'));

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'agent') return next(new Error('Invalid role'));

    const agent = await Agent.findById(payload.sub);
    if (!agent) return next(new Error('Agent not found'));

    if (agent.sessionVersion !== payload.sv) {
      return next(new Error('Session replaced'));
    }

    socket.agent = agent;
    socket.agentId = agent._id.toString();
    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});

agentIO.on('connection', (socket) => {
  console.log(`[Agent] New connection: ${socket.agent.username} (${socket.id}) for company: ${socket.agent.companyId}`);


  socket.on('joinConversation', (conversationId) => {
    if (!conversationId) return;
    socket.join(conversationId);
    console.log(`[Agent] ${socket.agent.username} joined room: ${conversationId}`);
  });


  socket.on('agentMessage', async ({ conversationId, text }) => {
    try {
      if (!text || !conversationId) return;

      const convo = await Conversation.findById(conversationId);
      if (!convo) return;

      // ✅ allow active (and optionally waiting_for_agent)
      //  if (!['active', 'waiting_for_agent'].includes(convo.status)) return;

      const msg = { from: 'agent', text, agentName: socket.agent.username, createdAt: new Date() };
      convo.messages.push(msg);
      await convo.save();

      // emit to both namespaces
      agentIO.to(conversationId).emit('message', msg);
      io.to(conversationId).emit('message', msg);
    } catch (e) {
      console.error('agentMessage error:', e);
    }
  });

  socket.on('acceptAudioCall', ({ conversationId }) => {
    console.log(`[Agent] ${socket.agent.username} accepting audio call in convo:`, conversationId);
    // Track this agent's socket ID so user's webrtc-offer can be forwarded directly
    callAgentMap.set(conversationId, socket.id);
    console.log(`[Agent] Mapped convo ${conversationId} → agent socket ${socket.id}`);
    io.to(conversationId).emit('audioCallAccepted', { conversationId });
  });


  socket.on('rejectAudioCall', ({ conversationId }) => {
    console.log('Agent rejecting audio call in convo:', conversationId);
    io.to(conversationId).emit('audioCallRejected', { conversationId });
  });

  // WebRTC signaling — agent → user
  socket.on('webrtc-answer', ({ conversationId, answer }) => {
    console.log(`[Signaling] Forwarding webrtc-answer from Agent to User for convo: ${conversationId}`);
    io.to(conversationId).emit('webrtc-answer', { conversationId, answer });
  });

  socket.on('webrtc-ice-candidate', ({ conversationId, candidate }) => {
    console.log(`[Signaling] Forwarding ICE candidate from Agent to User for convo: ${conversationId}`);
    io.to(conversationId).emit('webrtc-ice-candidate', { conversationId, candidate });
  });


  socket.on('endAudioCall', ({ conversationId }) => {
    io.to(conversationId).emit('audioCallEnded', { conversationId });
    agentIO.to(conversationId).emit('audioCallEnded', { conversationId });
  });

  socket.on('disconnect', () => {
    console.log('Agent socket disconnected:', socket.agent.username);
  });
});



const PORT = process.env.PORT || 5001;
server.listen(PORT, () =>
  console.log(`Backend running on :${PORT}`)
);

