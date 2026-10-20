import { z } from 'zod';

export const demoRequestSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(200),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .refine((value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    }),
  company: z.string().trim().min(2).max(160),
  role: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  solution: z.string().trim().min(1).max(160),
  website: z.string().max(0).optional().default(''),
});

export type DemoRequest = z.infer<typeof demoRequestSchema>;
