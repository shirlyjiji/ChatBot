const jwt = require('jsonwebtoken');

function signAgentToken(agent) {
  return jwt.sign(
    { sub: agent._id.toString(), role: 'agent', sv: agent.sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signAgentToken, verifyToken };
