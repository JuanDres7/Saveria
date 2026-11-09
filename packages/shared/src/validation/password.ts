import { z } from 'zod';

/** FR-003: al menos 8 caracteres, con una letra y un número. */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(1024, 'La contraseña es demasiado larga')
  .refine((value) => /\p{L}/u.test(value), 'La contraseña debe incluir al menos una letra')
  .refine((value) => /\d/.test(value), 'La contraseña debe incluir al menos un número');
