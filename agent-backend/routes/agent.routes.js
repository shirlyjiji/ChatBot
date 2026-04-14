const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Agent = require('../models/Agent');
const Conversation = require('../models/Conversation');
const { signAgentToken } = require('../utils/jwt');
const agentAuth = require('../middleware/agentAuth');

/**
 * AGENT LOGIN
 * POST /api/agents/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const agent = await Agent.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });

    if (!agent) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }


    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ SINGLE SESSION: invalidate old tokens
    agent.sessionVersion += 1;
    agent.lastLoginAt = new Date();
    agent.online = true; // Set online on login
    await agent.save();
    const token = signAgentToken(agent);

    res.json({
      token,
      agent: {
        _id: agent._id,
        companyId: agent.companyId,
        name: agent.name,
        username: agent.username,
        online: agent.online
      }
    });
  } catch (err) {
    console.error('Agent login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/me', agentAuth, async (req, res) => {
  const agent = await Agent.findById(req.agentAuth.sub).select('-password');
  if (!agent) return res.status(401).json({ message: 'Unauthorized' });
  res.json(agent);
});


/**
 * GET WAITING CONVERSATIONS (Company specific)
 * GET /api/agents/:agentId/:companyId/waiting
 */
router.get('/:agentId/:companyId/waiting', agentAuth, async (req, res) => {
  try {
    const sv = req.agentAuth.sv;
    const agentIdFromToken = req.agentAuth.sub;


    // Optional: ensure agent can only access their own chat
    if (req.params.agentId !== agentIdFromToken) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const agent = await Agent.findById(req.params.agentId);
    // ✅ Single-session enforcement
    if (agent.sessionVersion !== sv) {
      return res.status(401).json({ message: 'Session replaced. Please login again.' });
    }
    if (!agent) return res.status(401).json({ message: 'Agent not found' });
    if (agent.status == 'active' && agent.online && agent.acceptChat) {
      const chats = await Conversation.find({
        companyId: req.params.companyId,
        status: 'waiting_for_agent'
      });
      res.json(chats);
    } else {
      res.json([]);
    }


  } catch (err) {
    console.error('Fetch waiting chats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * ACCEPT CHAT
 * POST /api/agents/:agentId/accept/:conversationId
 */
router.post('/:agentId/accept/:conversationId', agentAuth, async (req, res) => {
  try {

    const agentIdFromToken = req.agentAuth.sub;
    const sv = req.agentAuth.sv;

    // Optional: ensure agent can only access their own chat
    if (req.params.agentId !== agentIdFromToken) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const agent = await Agent.findById(agentIdFromToken);
    if (!agent) return res.status(401).json({ message: 'Agent not found' });

    // ✅ Single-session enforcement
    if (agent.sessionVersion !== sv) {
      return res.status(401).json({ message: 'Session replaced. Please login again.' });
    }
    // ✅ If someone logged in elsewhere → logout this session
    if (agent.sessionVersion !== sv) {
      return res.status(401).json({ message: 'Session replaced. Please login again.' });
    }

    const convo = await Conversation.findById(req.params.conversationId);
    if (!convo) return res.status(404).json({ message: 'Not found' });

    convo.status = 'live';
    convo.agentId = req.params.agentId;
    await convo.save();

    const io = req.app.get('io');
    io.to(convo._id.toString()).emit('message', {
      from: 'bot',
      text: 'You are now connected to an agent.'
    });

    res.json(convo);
  } catch (err) {
    console.error('Accept chat error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/agents/:agentId/reject/:conversationId
 */
router.post('/:agentId/reject/:conversationId', agentAuth, async (req, res) => {
  try {
    const agentIdFromToken = req.agentAuth.sub;
    const sv = req.agentAuth.sv;

    if (req.params.agentId !== agentIdFromToken) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const agent = await Agent.findById(agentIdFromToken);
    if (!agent) return res.status(401).json({ message: 'Agent not found' });

    if (agent.sessionVersion !== sv) {
      return res.status(401).json({ message: 'Session replaced. Please login again.' });
    }

    const convo = await Conversation.findById(req.params.conversationId);
    if (!convo) return res.status(404).json({ message: 'Not found' });

    // Set back to bot
    convo.status = 'bot';
    await convo.save();

    const io = req.app.get('io');
    // Notify the conversation room
    io.to(convo._id.toString()).emit('chatRejected', {
      message: 'Your request was not accepted. Returning to bot mode.'
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Reject chat error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:agentId/history', agentAuth, async (req, res) => {

  const agentIdFromToken = req.agentAuth.sub;
  const sv = req.agentAuth.sv;

  // Optional: ensure agent can only access their own history
  if (req.params.agentId !== agentIdFromToken) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const agent = await Agent.findById(agentIdFromToken);
  if (!agent) return res.status(401).json({ message: 'Agent not found' });

  // ✅ Single-session enforcement
  if (agent.sessionVersion !== sv) {
    return res.status(401).json({ message: 'Session replaced. Please login again.' });
  }

  // ✅ If someone logged in elsewhere → logout this session
  if (agent.sessionVersion !== sv) {
    return res.status(401).json({ message: 'Session replaced. Please login again.' });
  }

  const chats = await Conversation.find({
    agentId: req.params.agentId,
    status: 'ended'
  }).sort({ endedAt: -1 });

  res.json(chats);
});

/**
* UPDATE AGENT ONLINE / OFFLINE STATUS
*/
router.post('/:agentId/status', agentAuth, async (req, res) => {
  try {

    const agentIdFromToken = req.agentAuth.sub;
    const sv = req.agentAuth.sv;

    // Optional: ensure agent can only access their own history
    if (req.params.agentId !== agentIdFromToken) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const activeagent = await Agent.findById(agentIdFromToken);
    if (!activeagent) return res.status(401).json({ message: 'Agent not found' });

    // ✅ Single-session enforcement
    if (activeagent.sessionVersion !== sv) {
      return res.status(401).json({ message: 'Session replaced. Please login again.' });
    }

    const { agentId } = req.params;

    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { $set: { online: req.body.status } },
      { new: true }
    );

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      success: true,
      online: agent.online
    });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});


router.post('/logout', agentAuth, async (req, res) => {
  const agentId = req.agentAuth.sub;

  const agent = await Agent.findById(agentId);
  if (!agent) return res.json({ success: true });

  // increment version so current token becomes invalid too
  agent.sessionVersion += 1;
  agent.lastLogoutAt = new Date();
  agent.online = false;
  await agent.save();

  res.json({ success: true });
});


module.exports = router;
