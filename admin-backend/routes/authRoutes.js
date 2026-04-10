// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Agent = require('../models/Agent');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 1. UPDATED: Specific Super Admin Credentials
  if (username === 'superadmin' && password === 'prabin@123') {

    const token = jwt.sign(
        { role: 'super_admin', username },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

    return res.json({ token,
      role: 'super-admin', 
      username: 'System Owner',
      companyId: null 
    });
  }

  // 2. Check Company Admin Table
  const company = await Company.findOne({ username });
  if (company && await bcrypt.compare(password, company.password)) {

    const token = jwt.sign(
        { role: 'admin', companyId: company._id },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

    return res.json({ token,
      role: 'admin', 
      companyId: company._id, 
      companyName: company.companyName,
      username: company.username 
    });
  }

  // 3. Check Agent Table
  const agent = await Agent.findOne({ username });
  if (agent && await bcrypt.compare(password, agent.password)) {

    const token = jwt.sign(
        { role: 'agent', companyId: agent.companyId, agentId: agent._id },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

    return res.json({ 
      token,
      role: 'agent', 
      companyId: agent.companyId, 
      username: agent.username 
    });
  }

  res.status(401).json({ message: "Invalid username or password" });
});

module.exports = router;