const { z } = require('zod');

function toBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val === 'false' || val === '0') return false;
    if (val === 'true' || val === '1') return true;
  }
  if (val === 0) return false;
  if (val === 1) return true;
  return Boolean(val);
}

const productSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(200),
  slug: z.string().max(200).optional().default(''),
  category: z.string().default('pulseras'),
  price: z.coerce.number({ invalid_type_error: 'Precio debe ser un número' }).positive('Precio debe ser mayor a 0'),
  description: z.string().max(2000).optional().default(''),
  emoji: z.string().max(10).optional().default('📿'),
  image: z.string().url('URL de imagen inválida').optional().or(z.literal('')).default(''),
  badge: z.string().max(50).optional().default(''),
  stock: z.coerce.number().int().nonnegative().optional().default(0),
  featured: z.preprocess(toBoolean, z.boolean().optional().default(false)),
  active: z.preprocess(toBoolean, z.boolean().optional().default(true)),
  sku: z.string().max(50).optional().default('')
});

const testimonialSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100).trim(),
  comment: z.string().min(1, 'Comentario es requerido').max(500).trim(),
  rating: z.number().int().min(1).max(5).default(5),
  image: z.string().optional().default(''),
  active: z.boolean().default(true)
});

const siteTextSchema = z.object({
  key: z.string().min(1, 'Clave es requerida').max(100),
  value: z.string().max(5000)
});

const sectionContentSchema = z.object({
  sectionKey: z.string().min(1, 'sectionKey es requerido').max(100),
  title: z.string().min(1, 'El título es requerido').max(200).trim(),
  subtitle: z.string().max(500).trim().optional().default('')
});

const orderSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().int().positive().optional(),
    qty: z.number().int().positive().optional(),
    emoji: z.string().max(10).optional().default('📿'),
    image: z.string().url('URL de imagen inválida').optional().or(z.literal('')).default('')
  })).min(1, 'Items son requeridos')
    .transform(items => items.map(item => ({ ...item, quantity: item.quantity || item.qty }))),
  total: z.number().positive('Total debe ser mayor a 0'),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }).optional().default({})
});

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario es requerido'),
  password: z.string().min(1, 'Contraseña es requerida')
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1, 'Comentario es requerido').max(1000),
  name: z.string().max(100).optional()
});

const newsletterSchema = z.object({
  email: z.string().email('Email inválido').max(255)
});

const contactSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100),
  email: z.string().email('Email inválido').max(255),
  message: z.string().min(1, 'Mensaje es requerido').max(2000)
});

module.exports = {
  productSchema,
  testimonialSchema,
  siteTextSchema,
  sectionContentSchema,
  orderSchema,
  loginSchema,
  reviewSchema,
  newsletterSchema,
  contactSchema
};
