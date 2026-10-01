import { z } from 'zod';

export const AuthLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const AuthRegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'editor']).optional()
});

export const AuthResponseSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.number().int().positive(),
    username: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'editor'])
  })
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email()
});

export const PasswordResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100)
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(100)
});

export type AuthLogin = z.infer<typeof AuthLoginSchema>;
export type AuthRegister = z.infer<typeof AuthRegisterSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordReset = z.infer<typeof PasswordResetSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;