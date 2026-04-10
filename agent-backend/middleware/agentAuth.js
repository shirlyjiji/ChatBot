const Agent = require('../models/Agent');
const { verifyToken } = require('../utils/jwt');

module.exports = function agentAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    const payload = verifyToken(token);

    if (payload.role !== 'agent') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    req.agentAuth = payload; // { sub, sv, ... }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid/Expired token' });
  }
};
