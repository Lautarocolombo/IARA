#!/usr/bin/env node
/**
 * Genera spec OpenAPI 3.0 a partir de esquemas Zod en validators.js
 * Compatible con Zod v4 - conversión manual sin zod-to-openapi
 * Uso: node src/scripts/generate-openapi.js
 * Salida: src/docs/swagger-generated.js
 */

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const validatorsPath = path.join(__dirname, '..', 'lib', 'validators.js');
const outputPath = path.join(__dirname, '..', 'docs', 'swagger-generated.js');

// Cargar esquemas Zod desde validators.js
const validatorsModule = require(validatorsPath);

// Mapeo de tipos Zod a tipos OpenAPI
function zodTypeToOpenAPI(zodType) {
  if (zodType instanceof z.ZodString) {
    const checks = zodType._def.checks || [];
    for (const check of checks) {
      if (check.kind === 'email') return { type: 'string', format: 'email' };
      if (check.kind === 'url') return { type: 'string', format: 'uri' };
      if (check.kind === 'uuid') return { type: 'string', format: 'uuid' };
    }
    return { type: 'string' };
  }
  if (zodType instanceof z.ZodNumber) {
    const checks = zodType._def.checks || [];
    let minimum = null, maximum = null, minimumExclusive = null, maximumExclusive = null;
    for (const check of checks) {
      if (check.kind === 'int') return { type: 'integer', format: 'int64' };
      if (check.kind === 'min') { minimum = check.value; minimumExclusive = check.inclusive === false; }
      if (check.kind === 'max') { maximum = check.value; maximumExclusive = check.inclusive === false; }
      if (check.kind === 'positive') minimum = 0;
      if (check.kind === 'nonnegative') minimum = 0;
    }
    return { type: 'number', format: 'double', minimum, maximum, minimumExclusive, maximumExclusive };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (zodType instanceof z.ZodArray) {
    return { type: 'array', items: zodTypeToOpenAPI(zodType._def.type) };
  }
  if (zodType instanceof z.ZodObject) {
    const shape = zodType._def.shape; // In Zod v4, shape is a property, not a function
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToOpenAPI(value);
      // Check if required (not optional)
      if (value instanceof z.ZodOptional === false && value instanceof z.ZodDefault === false) {
        required.push(key);
      }
    }
    return { type: 'object', properties, required: required.length > 0 ? required : undefined };
  }
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToOpenAPI(zodType._def.innerType);
  }
  if (zodType instanceof z.ZodDefault) {
    return zodTypeToOpenAPI(zodType._def.innerType);
  }
  if (zodType instanceof z.ZodEnum) {
    return { type: 'string', enum: zodType._def.values };
  }
  if (zodType instanceof z.ZodLiteral) {
    return { const: zodType._def.value };
  }
  if (zodType instanceof z.ZodUnion) {
    return { anyOf: zodType._def.options.map(zodTypeToOpenAPI) };
  }
  if (zodType instanceof z.ZodTransform) {
    return zodTypeToOpenAPI(zodType._def.schema);
  }
  if (zodType instanceof z.ZodNullable) {
    return { nullable: true, ...zodTypeToOpenAPI(zodType._def.innerType) };
  }
  if (zodType instanceof z.ZodNull) {
    return { type: 'null' };
  }
  if (zodType instanceof z.ZodAny) {
    return {};
  }
  return { type: 'object' };
}

function generateOpenAPISpec() {
  const schemas = {};

  // Esquemas Zod a OpenAPI
  Object.entries(validatorsModule).forEach(([key, schema]) => {
    if (schema instanceof z.ZodType) {
      const openapiSchema = zodTypeToOpenAPI(schema);
      // Convertir a formato OpenAPI schema object
      const schemaObj = { ...openapiSchema };
      if (schemaObj.required && schemaObj.required.length === 0) {
        delete schemaObj.required;
      }
      // Limpiar undefined/null
      Object.keys(schemaObj).forEach(k => {
        if (schemaObj[k] === undefined || schemaObj[k] === null) {
          delete schemaObj[k];
        }
      });
      schemas[key] = schemaObj;
    }
  });

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'IARA Backend API',
      description: 'API documentation for the IARA Artesanías Gualeguay backend (auto-generado desde Zod)',
      version: '1.0.0',
      contact: {
        name: 'IARA Support',
        email: 'contacto@artesaniagualeguay.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Local development server (v1)'
      },
      {
        url: 'https://iara-backend.onrender.com/api/v1',
        description: 'Production server (Render) - v1'
      }
    ],
    tags: [
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Users', description: 'User management (admin only)' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Payments', description: 'Payment processing' },
      { name: 'Products', description: 'Product catalog' },
      { name: 'Email', description: 'Email services' },
      { name: 'MercadoPago', description: 'MercadoPago integration' },
      { name: 'Health', description: 'Health checks' }
    ],
    paths: {
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'User login',
          description: 'Authenticate user and receive JWT tokens',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/loginSchema' }
              }
            }
          },
          responses: {
            '200': { description: 'Login successful', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'string' }, role: { type: 'string' } } } } } },
            '401': { description: 'Invalid credentials' },
            '400': { description: 'Missing fields' }
          }
        }
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          description: 'Refresh the JWT access token using refresh cookie',
          responses: {
            '200': { description: 'Token refreshed', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
            '401': { description: 'Invalid refresh token' }
          }
        }
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          description: 'Invalidate current session',
          responses: { '200': { description: 'Logged out' } }
        }
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset',
          description: 'Sends a password reset email',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } }
          },
          responses: { '200': { description: 'If email exists, reset link sent' } }
        }
      },
      '/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password',
          description: 'Reset password using token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, newPassword: { type: 'string' } } } } }
          },
          responses: { '200': { description: 'Password reset' }, '400': { description: 'Invalid token' } }
        }
      },
      '/users/login': {
        post: {
          tags: ['Users'],
          summary: 'User login (API)',
          description: 'Login for users via API',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } } } }
          },
          responses: { '200': { description: 'Login successful' }, '401': { description: 'Invalid credentials' } }
        }
      },
      '/users': {
        get: {
          tags: ['Users'],
          summary: 'List users',
          description: 'List all users with pagination and filters (admin only)',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } },
            { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'editor', 'viewer'] } },
            { name: 'active', in: 'query', schema: { type: 'boolean' } },
            { name: 'q', in: 'query', schema: { type: 'string' } }
          ],
          responses: { '200': { description: 'Users list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } }
        },
        post: {
          tags: ['Users'],
          summary: 'Create user',
          description: 'Create a new user (admin only)',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' }, role: { type: 'string', enum: ['admin', 'editor', 'viewer'] }, email: { type: 'string', format: 'email' } } } } }
          },
          responses: { '201': { description: 'User created' }, '400': { description: 'Validation error' }, '409': { description: 'Username/email exists' } }
        }
      },
      '/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get user',
          description: 'Get user by ID (admin only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'User data' }, '404': { description: 'User not found' } }
        },
        put: {
          tags: ['Users'],
          summary: 'Update user',
          description: 'Update user by ID (admin only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { password: { type: 'string' }, role: { type: 'string', enum: ['admin', 'editor', 'viewer'] }, active: { type: 'boolean' }, email: { type: 'string', format: 'email' } } } } }
          },
          responses: { '200': { description: 'User updated' }, '404': { description: 'User not found' } }
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete user',
          description: 'Delete user by ID (admin only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'User deleted' }, '404': { description: 'User not found' } }
        }
      },
      '/orders': {
        post: {
          tags: ['Orders'],
          summary: 'Create order',
          description: 'Create a new order',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/orderSchema' } } }
          },
          responses: { '201': { description: 'Order created' } }
        }
      },
      '/orders/{id}': {
        get: {
          tags: ['Orders'],
          summary: 'Get order',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Order data' } }
        }
      },
      '/payments/mercadopago/preference': {
        post: {
          tags: ['MercadoPago'],
          summary: 'Create MP preference',
          description: 'Create a MercadoPago payment preference',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array' }, payer_email: { type: 'string', format: 'email' }, back_urls: { type: 'object' }, notification_url: { type: 'string' } } } } }
          },
          responses: { '200': { description: 'Preference created' }, '500': { description: 'MP error' } }
        }
      },
      '/payments/mercadopago/status/{paymentId}': {
        get: {
          tags: ['MercadoPago'],
          summary: 'Get payment status',
          description: 'Check payment status from MercadoPago',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Payment status' } }
        }
      },
      '/payments/webhook/mercadopago': {
        post: {
          tags: ['MercadoPago'],
          summary: 'MercadoPago webhook',
          description: 'Receive webhook notifications from MercadoPago',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string' }, data: { type: 'object' }, action: { type: 'string' } } } } }
          },
          responses: { '200': { description: 'Webhook processed' } }
        }
      },
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: { '200': { description: 'OK' } }
        }
      }
    },
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        User: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' }, role: { type: 'string', enum: ['admin', 'editor', 'viewer'] }, permissions: { type: 'object' }, active: { type: 'boolean' }, email: { type: 'string', format: 'email' }, created_at: { type: 'string', format: 'date-time' } } },
        CreateUser: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' }, role: { type: 'string', enum: ['admin', 'editor', 'viewer'] }, email: { type: 'string', format: 'email' } } },
        Order: { type: 'object', properties: { id: { type: 'integer' }, items: { type: 'array' }, total: { type: 'number' }, status: { type: 'string', enum: ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] }, customer: { type: 'object' }, created_at: { type: 'string', format: 'date-time' } } }
      }
    }
  };

  return spec;
}

function main() {
  try {
    const spec = generateOpenAPISpec();
    const output = `const swaggerSpec = ${JSON.stringify(spec, null, 2)};\n\nfunction buildOpenAPI(req, res) {\n  res.setHeader('Content-Type', 'application/json');\n  res.json(swaggerSpec);\n}\n\nmodule.exports = { buildOpenAPI, swaggerSpec };\n`;
    
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ OpenAPI spec generado en: ${outputPath}`);
  } catch (err) {
    console.error('❌ Error generando OpenAPI spec:', err);
    process.exit(1);
  }
}

main();