import { z } from 'zod';

export const ProductImageSchema = z.object({
  id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  image_url: z.string().url(),
  alt: z.string().optional(),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  es_principal: z.boolean(),
  orden: z.number().int().nonnegative(),
  created_at: z.string().datetime()
});

export const ProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  category: z.string().min(1),
  stock: z.number().int().nonnegative(),
  active: z.boolean(),
  deleted: z.boolean(),
  sku: z.string().optional(),
  featured: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  images: z.array(ProductImageSchema).optional()
});

export const ProductListSchema = z.array(ProductSchema);

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  price: z.number().positive(),
  category: z.string().min(1).max(100),
  stock: z.number().int().nonnegative(),
  sku: z.string().max(50).optional(),
  featured: z.boolean().optional()
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export const CategorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  image: z.string().url().optional(),
  active: z.boolean(),
  featured: z.boolean(),
  orden: z.number().int().nonnegative(),
  parent_id: z.number().int().positive().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CategoryListSchema = z.array(CategorySchema);

export type Product = z.infer<typeof ProductSchema>;
export type ProductImage = z.infer<typeof ProductImageSchema>;
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
export type Category = z.infer<typeof CategorySchema>;