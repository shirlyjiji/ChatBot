const router = require('express').Router();
const Company = require('../models/Company');
const Flow = require('../models/Flow');
const Conversation = require('../models/Conversation');
const { getNextNode } = require('../utils/flowExecutor');
const Report = require('../models/Report');
const Appointment = require('../models/Appointment');
const Agent = require('../models/Agent');

/**
 * START CHAT
 */
router.post('/start', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { guestName, guestEmail } = req.body;

  console.log(`Incoming x-api-key header: [${apiKey}]`);
  if (!apiKey || apiKey === 'null' || apiKey === 'undefined') {
    return res.status(403).json({ message: 'API key missing in request' });
  }
  const company = await Company.findOne({ apiKey });
  if (!company) return res.status(403).json({ message: 'Invalid API key' });

  const flow = await Flow.findOne({ companyId: company._id });
  console.log(`Looking for flow for companyId: ${company._id}, found: ${!!flow}`);
  if (!flow) return res.status(404).json({ message: 'Flow not found' });

  const startNode = flow.nodes.find(n => n.type === 'startNode');
  if (!startNode) {
    return res.status(400).json({ message: 'Start node missing in flow' });
  }

  const convo = await Conversation.create({
    companyId: company._id,
    flowId: flow._id,
    currentNodeId: startNode.id,
    guestName,
    guestEmail,
    messages: [{ from: 'bot', text: startNode.data.label }]
  });

  // Move to first real node (if any)
  const firstEdge = flow.edges.find(e => e.source === startNode.id);
  const nextNode = firstEdge
    ? flow.nodes.find(n => n.id === firstEdge.target)
    : null;

  if (nextNode) {
    convo.currentNodeId = nextNode.id;
    await convo.save();
  }

  res.json({
    conversationId: convo._id,
    startMessage: startNode.data.label,
    currentNode: nextNode // may be null
  });
});

/**
 * NEXT STEP
 */
router.post('/next', async (req, res) => {
  const { conversationId, userInput } = req.body;

  const convo = await Conversation.findById(conversationId);
  const flow = await Flow.findById(convo.flowId);

  const currentNode = flow.nodes.find(
    n => n.id === convo.currentNodeId
  );

  // ---------------- SAVE USER MESSAGE ----------------
  if (userInput?.text) {
    convo.messages.push({ from: 'user', text: userInput.text, createdAt: new Date() });
  }

  // ---------------- REPORT LOGGING ----------------
  if (currentNode.data?.includeInReport && userInput?.text) {
    await Report.create({
      companyId: convo.companyId,
      conversationId: convo._id,
      nodeId: currentNode.id,
      question: currentNode.data.label,
      answer: userInput.text
    });
  }

  // ---------------- OPTION NODE VALIDATION ----------------
  if (currentNode.type === 'optionNode') {
    if (userInput.optionIndex === undefined) {
      await convo.save();
      return res.json({ repeat: true });
    }
  }

  // ---------------- APPOINTMENT HANDLING ----------------
  if (currentNode.type === 'appointmentNode' && userInput?.appointment) {
    const { date, time } = userInput.appointment;

    await Appointment.create({
      companyId: convo.companyId,
      conversationId: convo._id,
      date,
      time
    });

    if (currentNode.data?.includeInReport) {
      await Report.create({
        companyId: convo.companyId,
        conversationId: convo._id,
        nodeId: currentNode.id,
        question: currentNode.data.label,
        answer: `${date} ${time}`
      });
    }
  }

  // ---------------- MOVE FLOW ----------------
  let nodeToProcess = getNextNode(flow, convo.currentNodeId, userInput);
  const messagesToReturn = [];

  while (nodeToProcess) {
    convo.currentNodeId = nodeToProcess.id;
    convo.status = 'bot';

    // Collect message
    let text = nodeToProcess.type === 'optionNode'
      ? nodeToProcess.data.question
      : nodeToProcess.data.label;

    if (nodeToProcess.type === 'agentNode') {
      text = 'Connecting you to an agent...';
    }

    const newMsg = {
      from: 'bot',
      text: text,
      createdAt: new Date()
    };
    convo.messages.push(newMsg);
    messagesToReturn.push(newMsg);

    // If it's an interactive node EXCEPT agentNode (which needs availability check), stop here
    const isInteractive = ['optionNode', 'inputNode', 'appointmentNode', 'endNode'].includes(nodeToProcess.type);
    if (isInteractive) break;

    // Special handling for agentNode
    if (nodeToProcess.type === 'agentNode') {
      const onlineAgents = await Agent.find({
        companyId: convo.companyId,
        status: 'active',
        online: true,
        acceptChat: true
      });

      if (onlineAgents.length === 0) {
        // Replace the last message with 'No agents are available'
        convo.messages.pop();
        messagesToReturn.pop();

        const noAgentMsg = { from: 'bot', text: 'No agents are available', createdAt: new Date() };
        convo.messages.push(noAgentMsg);
        messagesToReturn.push(noAgentMsg);

        await convo.save();
        return res.json({ noAgent: true, message: 'No agents are available', messages: messagesToReturn });
      }

      // Agent is available, queue the user
      convo.status = 'waiting_for_agent';
      await convo.save();
      return res.json({ agent: true, conversationId: convo._id, messages: messagesToReturn, node: nodeToProcess });
    }

    // Move to next node automatically (no userInput needed for intermediate steps like messageNode)
    const nextNode = getNextNode(flow, nodeToProcess.id, null);
    if (!nextNode) break;
    nodeToProcess = nextNode;
  }

  if (!nodeToProcess && messagesToReturn.length === 0) {
    await convo.save();
    return res.json({ end: true });
  }

  // Handle endNode
  if (nodeToProcess?.type === 'endNode') {
    await convo.save();
    return res.json({ end: true, messages: messagesToReturn });
  }

  await convo.save();
  res.json({ node: nodeToProcess, messages: messagesToReturn });
});

// REQUEST LIVE AGENT DIRECTLY
router.post('/request-agent', async (req, res) => {
  const { conversationId } = req.body;

  const convo = await Conversation.findById(conversationId);
  if (!convo) return res.status(404).json({ message: 'Conversation not found' });

  // Check if any agents are online for this company
  const Agent = require('../models/Agent');
  const onlineAgents = await Agent.find({
    companyId: convo.companyId,
    status: 'active',
    online: true,
    acceptChat: true
  });

  if (onlineAgents.length === 0) {
    convo.messages.push({
      from: 'bot',
      text: 'No agents are available',
      createdAt: new Date()
    });
    await convo.save();

    return res.json({
      noAgent: true,
      message: 'No agents are available'
    });
  }

  // Agent is available, queue the user
  convo.status = 'waiting_for_agent';
  convo.messages.push({
    from: 'bot',
    text: 'Connecting you to an agent...',
    createdAt: new Date()
  });
  await convo.save();

  return res.json({
    agent: true,
    conversationId: convo._id
  });
});

//End Chat
router.post('/end', async (req, res) => {
  const { conversationId, endedBy } = req.body;

  const convo = await Conversation.findById(conversationId);
  if (!convo) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  convo.status = 'ended';
  convo.endedBy = endedBy; // 'user' | 'agent'
  convo.endedAt = new Date();
  const systemText =
    convo.endedBy === 'user'
      ? 'User ended the chat.'
      : 'Agent ended the chat.';


  const io = req.app.get('io');
  if (io) {


    io.to(conversationId).emit('chatEnded', { endedBy: convo.endedBy });
    io.of('/agent').to(conversationId).emit('chatEnded', { endedBy: convo.endedBy });

    io.to(conversationId).emit('message', { from: 'system', text: systemText });
    io.of('/agent').to(conversationId).emit('message', { from: 'system', text: systemText });
  }
  convo.messages.push({ from: 'bot', text: systemText, createdAt: new Date() });



  await convo.save();

  res.json({ success: true });
});

// RESTART CONVERSATION (BACK TO MENU)
router.post('/restart', async (req, res) => {
  const { conversationId } = req.body;

  try {
    const convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });

    const flow = await Flow.findById(convo.flowId);
    if (!flow) return res.status(404).json({ message: 'Flow not found' });

    const startNode = flow.nodes.find(n => n.type === 'startNode');
    if (!startNode) return res.status(400).json({ message: 'Start node missing' });

    // Move back to first real node
    const firstEdge = flow.edges.find(e => e.source === startNode.id);
    const nextNode = firstEdge
      ? flow.nodes.find(n => n.id === firstEdge.target)
      : null;

    convo.currentNodeId = nextNode ? nextNode.id : startNode.id;
    convo.status = 'bot';

    const textMsg = nextNode?.type === 'optionNode'
      ? nextNode.data.question
      : (nextNode?.data.label || 'How can I help you today?');

    convo.messages.push({
      from: 'bot',
      text: textMsg,
      createdAt: new Date()
    });

    await convo.save();

    res.json({
      success: true,
      currentNode: nextNode,
      message: textMsg
    });
  } catch (err) {
    console.error('Restart chat error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
