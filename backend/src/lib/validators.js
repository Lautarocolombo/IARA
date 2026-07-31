const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(200),
  category: z.string().default('pulseras'),
  price: z.number().positive('Precio debe ser mayor a 0'),
  description: z.string().max(2000).optional().default(''),
  emoji: z.string().max(10).optional().default('📿'),
  image: z.string().url('URL de imagen inválida').optional().or(z.literal('')).default(''),
  badge: z.string().max(50).optional().default(''),
  stock: z.number().int().nonnegative().optional().default(0)
});

const testimonialSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100),
  comment: z.string().min(1, 'Comentario es requerido').max(1000),
  rating: z.number().int().min(1).max(5).default(5),
  image: z.string().optional().default(''),
  active: z.boolean().default(true)
});

const siteTextSchema = z.object({
  key: z.string().min(1, 'Clave es requerida').max(100),
  value: z.string().max(5000)
});

const orderSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().int().positive()
  })).min(1, 'Items son requeridos'),
  total: z.number().positive('Total debe ser mayor a 0'),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }).optional().default({})
});

const publicOrderSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string().optional(),
    price: z.number().optional(),
    qty: z.number().int().positive().optional()
  })).min(1, 'Items son requeridos'),
  total: z.number().positive('Total debe ser mayor a 0').optional(),
  shipping_name: z.string().min(1, 'Nombre de envío es requerido'),
  shipping_address: z.string().min(1, 'Dirección de envío es requerida'),
  shipping_phone: z.string().min(1, 'Teléfono de envío es requerido'),
  shipping_zip: z.string().min(1, 'Código postal es requerido'),
  shipping_city: z.string().optional(),
  shipping_email: z.string().email('Email inválido').optional(),
  subtotal: z.number().nonnegative().optional(),
  shipping_cost: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional()
});

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario es requerido'),
  password: z.string().min(1, 'Contraseña es requerida')
});

const subscribeSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().max(100).optional().default('')
});

module.exports = {
  productSchema,
  testimonialSchema,
  siteTextSchema,
  orderSchema,
  publicOrderSchema,
  loginSchema,
  subscribeSchema
};
