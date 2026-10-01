import { z } from 'zod';

export const ContactSchema = z.object({
  WHATSAPP: z.string().min(1),
  WHATSAPP_ALIAS: z.string().min(1),
  PHONE: z.string().min(1),
  EMAIL: z.string().email(),
  ADDRESS: z.string().min(1),
  COORDINATES: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  GOOGLE_MAPS_API_KEY: z.string().optional()
});

export const CartSchema = z.object({
  STORAGE_KEY: z.string(),
  SHIPPING_COST: z.number().nonnegative(),
  SHIPPING_THRESHOLD: z.number().nonnegative(),
  FREE_SHIPPING_TEXT: z.string()
});

export const ThemeSchema = z.object({
  STORAGE_KEY: z.string(),
  DEFAULT: z.enum(['light', 'dark']),
  OPTIONS: z.array(z.enum(['light', 'dark']))
});

export const BusinessSchema = z.object({
  NAME: z.string().min(1),
  SLOGAN: z.string().min(1),
  LOGO: z.string().min(1),
  YEAR_FOUNDED: z.number().int().positive()
});

export const AnalyticsSchema = z.object({
  GOOGLE_ID: z.string().optional(),
  FACEBOOK_PIXEL_ID: z.string().optional(),
  SENTRY_DSN: z.string().optional()
});

export const AnimationsSchema = z.object({
  REVEAL_THRESHOLD: z.number(),
  TOAST_DURATION: z.number().int().positive(),
  TRANSITION_SPEED: z.number()
});

export const ApiSchema = z.object({
  BASE: z.string().optional(),
  BACKEND_URL: z.string().optional()
});

export const PlaceholderSchema = z.object({
  IMAGE: z.string().url().or(z.string().startsWith('/'))
});

export const LinksSchema = z.object({
  INSTAGRAM: z.string().url().optional().or(z.literal('')),
  FACEBOOK: z.string().url().optional().or(z.literal('')),
  TWITTER: z.string().url().optional().or(z.literal(''))
});

export const HoursSchema = z.object({
  WEEKDAY: z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/)
  }),
  SATURDAY: z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/)
  }),
  CLOSED: z.array(z.string())
});

export const ReviewsSchema = z.object({
  GOOGLE_PLACE_ID: z.string().optional(),
  GOOGLE_WRITE_REVIEW_URL: z.string().url().optional()
});

export const PaymentConfigSchema = z.object({
  transferAlias: z.string().optional(),
  holderName: z.string().optional(),
  cbuCvu: z.string().optional(),
  whatsapp: z.string().optional(),
  message: z.string().optional(),
  active: z.boolean(),
  mpEnabled: z.boolean(),
  cashEnabled: z.boolean(),
  shippingCost: z.number().nonnegative(),
  freeShippingFrom: z.number().nonnegative(),
  includedShippingCost: z.number().nonnegative()
});

export const PublicConfigSchema = z.object({
  CONTACT: ContactSchema,
  REVIEWS: ReviewsSchema,
  CART: CartSchema,
  THEME: ThemeSchema,
  BUSINESS: BusinessSchema,
  ANALYTICS: AnalyticsSchema,
  ANIMATIONS: AnimationsSchema,
  API: ApiSchema,
  PLACEHOLDER: PlaceholderSchema,
  LINKS: LinksSchema,
  HOURS: HoursSchema,
  PAYMENT: PaymentConfigSchema
});

export type PublicConfig = z.infer<typeof PublicConfigSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type CartConfig = z.infer<typeof CartSchema>;
export type ThemeConfig = z.infer<typeof ThemeSchema>;
export type BusinessConfig = z.infer<typeof BusinessSchema>;
export type AnalyticsConfig = z.infer<typeof AnalyticsSchema>;
export type AnimationsConfig = z.infer<typeof AnimationsSchema>;
export type ApiConfig = z.infer<typeof ApiSchema>;
export type PlaceholderConfig = z.infer<typeof PlaceholderSchema>;
export type LinksConfig = z.infer<typeof LinksSchema>;
export type HoursConfig = z.infer<typeof HoursSchema>;
export type ReviewsConfig = z.infer<typeof ReviewsSchema>;
export type PaymentConfig = z.infer<typeof PaymentConfigSchema>;