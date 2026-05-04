import { z } from 'zod';

const codeRegex = /^[a-z][a-z0-9_-]{1,62}$/;

export const serviceFormSchema = z.object({
  code: z
    .string()
    .min(2, 'Код минимум 2 символа')
    .max(63, 'Код слишком длинный')
    .regex(codeRegex, 'Только латиница в нижнем регистре, цифры, _ или -; начинается с буквы'),
  name: z.string().min(2, 'Название минимум 2 символа').max(255),
  shortName: z.string().max(128).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  defaultMethod: z.string().max(128).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;
