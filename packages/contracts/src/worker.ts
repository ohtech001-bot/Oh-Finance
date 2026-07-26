import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common.js';

export const createWorkerSchema = z.object({
  name: z.string().trim().min(2, 'اسم العامل مطلوب.').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^05\d{8}$/, 'رقم الهاتف يجب أن يتكون من 10 أرقام ويبدأ بـ 05.'),
  email: z.string().trim().toLowerCase().email('أدخل بريدًا إلكترونيًا صحيحًا.').max(254),
  password: z.string().min(8, 'كلمة السر يجب أن تتكون من 8 أحرف على الأقل.').max(128),
});
export type CreateWorkerRequest = z.infer<typeof createWorkerSchema>;

export const updateWorkerSchema = createWorkerSchema.extend({
  password: z
    .union([
      z.literal(''),
      z.string().min(8, 'كلمة السر يجب أن تتكون من 8 أحرف على الأقل.').max(128),
    ])
    .optional(),
});
export type UpdateWorkerRequest = z.infer<typeof updateWorkerSchema>;

export const setWorkerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
export type SetWorkerStatusRequest = z.infer<typeof setWorkerStatusSchema>;

export const workerSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  createdAt: isoDateTimeSchema,
});
export type Worker = z.infer<typeof workerSchema>;
