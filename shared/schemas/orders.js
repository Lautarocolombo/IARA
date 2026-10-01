import { z } from 'zod';

export const OrderItemSchema = z.object({
  id: z.number().int().positive(),
  order_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  product_name: z.string(),
  product_price: z.number().positive(),
  quantity: z.number().int().positive(),
  subtotal: z.number().positive()
});

export const ShippingInfoSchema = z.object({
  shipping_name: z.string().min(1),
  shipping_address: z.string().min(1),
  shipping_phone: z.string().min(1),
  shipping_zip: z.string().min(1),
  shipping_city: z.string().min(1),
  shipping_email: z.string().email(),
  shipping_province: z.string().min(1),
  shipping_cost: z.number().nonnegative()
});

export const OrderSchema = z.object({
  id: z.number().int().positive(),
  order_token: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  payment_method: z.enum(['transfer', 'mercadopago', 'cash']),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']),
  subtotal: z.number().nonnegative(),
  shipping_cost: z.number().nonnegative(),
  total: z.number().positive(),
  customer_email: z.string().email(),
  customer_notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  items: z.array(OrderItemSchema).optional(),
  shipping: ShippingInfoSchema.optional(),
  payment_proof: z.object({
    id: z.number().int().positive(),
    file_url: z.string().url(),
    status: z.enum(['pending', 'approved', 'rejected']),
    uploaded_at: z.string().datetime()
  }).optional()
});

export const OrderListSchema = z.array(OrderSchema);

export const OrderCreateSchema = z.object({
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().positive()
  })).min(1),
  payment_method: z.enum(['transfer', 'mercadopago', 'cash']),
  shipping: ShippingInfoSchema,
  coupon_code: z.string().optional(),
  notes: z.string().optional()
});

export const OrderStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional()
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type ShippingInfo = z.infer<typeof ShippingInfoSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderStatusUpdate = z.infer<typeof OrderStatusUpdateSchema>;