const express = require('express');
const router = express.Router();
const { swaggerSpec } = require('../docs/swagger');

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

module.exports = router;
