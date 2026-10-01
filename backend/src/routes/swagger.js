const express = require('express');
const { swaggerSpec } = require('../docs/swagger');
const { buildOpenAPI } = require('../docs/swagger');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    name: 'IARA Backend API',
    version: '1.0.0',
    docs: '/api-docs',
    specs: swaggerSpec
  });
});

router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

router.get('/docs', buildOpenAPI);

module.exports = router;
