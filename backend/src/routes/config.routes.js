const { Router } = require('express');
const env = require('../config/env');
const DOC_TYPES = require('../config/docTypes');

const router = Router();

router.get('/', (req, res) => {
  res.json({ docTypes: DOC_TYPES, emailEnabled: env.emailConfigured, companyName: env.companyName });
});

module.exports = router;
