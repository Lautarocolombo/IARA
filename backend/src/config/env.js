/**
 * Validación de variables de entorno con Zod
 * Fallar rápido al arrancar con mensajes claros si faltan o son inválidas
 */

const { z } = require('zod');

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ADMIN_USER: z.string().min(1, 'ADMIN_USER es requerido'),
  ADMIN_PASS_HASH: z.string().min(1, 'ADMIN_PASS_HASH es requerido'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET debe tener al menos 32 caracteres').optional(),
  SESSION_SECRET: z.string().min(32).optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),
  ALLOWED_ORIGIN: z.string().optional(),

  // Frontend
  SITE_URL: z.string().url().optional(),
  BACKEND_URL: z.string().url().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Analytics
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  FACEBOOK_PIXEL_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // Business
  BUSINESS_NAME: z.string().default('Artesanías Gualeguay'),
  BUSINESS_EMAIL: z.string().email().default('contacto@artesaniagualeguay.com'),
  WHATSAPP: z.string().default('+543444634444'),
  INSTAGRAM_URL: z.string().url().optional(),
  FACEBOOK_URL: z.string().url().optional(),
  TWITTER_URL: z.string().url().optional(),

  // Shipping
  SHIPPING_COST: z.coerce.number().default(200),
  SHIPPING_THRESHOLD: z.coerce.number().default(2000),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Metrics
  METRICS_TOKEN: z.string().optional(),
  METRICS_ALLOWED_IPS: z.string().optional(),

  // Debug
  DEBUG_API_ERROR: z.preprocess(v => v === 'true', z.boolean().default(false)),
  FIX_SEQUENCES: z.preprocess(v => v === 'true', z.boolean().default(false)),
  SEED_DEFAULT_CONTENT: z.preprocess(v => v === 'true', z.boolean().default(false)),
  SEED_LOCAL_DATA: z.preprocess(v => v === 'true', z.boolean().default(false)),
});

function validateEnv() {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return process.env;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors).flatMap(([field, messages]) =>
      messages.map(msg => `  - ${field}: ${msg}`)
    ).join('\n');

    const message = `\n❌ Variables de entorno inválidas:\n${messages}\n`;
    console.error(message);
    process.exit(1);
  }

  return result.data;
}

module.exports = { validateEnv, envSchema };