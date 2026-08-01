global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ADMIN_USER = process.env.ADMIN_USER || 'testadmin';
process.env.DATABASE_URL = '';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
