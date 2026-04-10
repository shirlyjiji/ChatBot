const router = require('express').Router();
const Conversation = require('../models/Conversation');
const Flow = require('../models/Flow');
const validateApiKey = require('../middleware/validateApiKey');
const agentAuth = require('../middleware/agentAuth');

router.post('/start', validateApiKey, async (req, res) => {
  const flow = await Flow.findOne({ companyId: req.company._id });
  const startNode = flow.nodes.find(n => n.type === 'startNode');

  const convo = await Conversation.create({
    companyId: req.company._id,
    flowId: flow._id,
    currentNodeId: startNode.id,
    messages: [{ from: 'bot', text: startNode.data.label }]
  });

  res.json(convo);
});

router.post('/:id/next', validateApiKey, async (req, res) => {
  const convo = await Conversation.findById(req.params.id);
  convo.messages.push({ from: 'user', text: req.body.input, createdAt: new Date()  });
  await convo.save();
  res.json(convo);
});

router.get('/:id', agentAuth, async (req, res) => {
  const convo = await Conversation.findById(req.params.id);
  if (!convo) return res.status(404).json({ message: 'Not found' });

  // ✅ Optional security: agent can only read their company’s conversations
  // If you have agent.companyId in middleware, validate it here.
  // Or at least ensure the agent is the assigned agent:
 if (String(convo.agentId) !== req.agentAuth.sub) return res.status(403).json({ message: 'Forbidden' });

  res.json(convo);
});

module.exports = router;
