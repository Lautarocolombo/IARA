import { z } from 'zod';

export const SiteSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  tenant_id: z.string().optional()
});

export const SiteSettingsResponseSchema = z.record(z.string());

export const SiteTextSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  tenant_id: z.string().optional()
});

export const SiteTextsResponseSchema = z.record(z.string());

export const HeroCardSchema = z.object({
  id: z.number().int().positive(),
  slot: z.enum(['left', 'right']),
  titulo: z.string().min(1),
  subtitulo: z.string().optional(),
  cta_texto: z.string().optional(),
  cta_url: z.string().url().optional(),
  image_url: z.string().url().optional(),
  active: z.boolean(),
  orden: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const HeroCardListSchema = z.array(HeroCardSchema);

export const HeroCardCreateSchema = z.object({
  slot: z.enum(['left', 'right']),
  titulo: z.string().min(1).max(200),
  subtitulo: z.string().max(500).optional(),
  cta_texto: z.string().max(100).optional(),
  cta_url: z.string().url().optional(),
  image_url: z.string().url().optional(),
  active: z.boolean().optional(),
  orden: z.number().int().nonnegative().optional()
});

export const HeroCardUpdateSchema = HeroCardCreateSchema.partial();

export const CarouselImageSchema = z.object({
  id: z.number().int().positive(),
  slot: z.string().min(1),
  image_url: z.string().url(),
  caption: z.string().optional(),
  active: z.boolean(),
  orden: z.number().int().nonnegative(),
  created_at: z.string().datetime()
});

export const CarouselImageListSchema = z.array(CarouselImageSchema);

export const TestimonialSchema = z.object({
  id: z.number().int().positive(),
  author: z.string().min(1),
  content: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  product_id: z.number().int().positive().optional(),
  active: z.boolean(),
  created_at: z.string().datetime()
});

export const TestimonialListSchema = z.array(TestimonialSchema);

export const TestimonialCreateSchema = z.object({
  author: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
  rating: z.number().int().min(1).max(5),
  product_id: z.number().int().positive().optional()
});

export const TestimonialUpdateSchema = TestimonialCreateSchema.partial();

export const NewsletterSubscriberSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  active: z.boolean(),
  created_at: z.string().datetime()
});

export const NewsletterSubscribeSchema = z.object({
  email: z.string().email()
});

export type SiteSetting = z.infer<typeof SiteSettingSchema>;
export type SiteText = z.infer<typeof SiteTextSchema>;
export type HeroCard = z.infer<typeof HeroCardSchema>;
export type HeroCardCreate = z.infer<typeof HeroCardCreateSchema>;
export type HeroCardUpdate = z.infer<typeof HeroCardUpdateSchema>;
export type CarouselImage = z.infer<typeof CarouselImageSchema>;
export type Testimonial = z.infer<typeof TestimonialSchema>;
export type TestimonialCreate = z.infer<typeof TestimonialCreateSchema>;
export type TestimonialUpdate = z.infer<typeof TestimonialUpdateSchema>;
export type NewsletterSubscriber = z.infer<typeof NewsletterSubscriberSchema>;
export type NewsletterSubscribe = z.infer<typeof NewsletterSubscribeSchema>;