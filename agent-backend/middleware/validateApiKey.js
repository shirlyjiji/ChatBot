const Company = require('../models/Company');

module.exports = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key) return res.sendStatus(401);

  const company = await Company.findOne({ apiKey: key });
  if (!company) return res.sendStatus(403);

  req.company = company;
  next();
};
