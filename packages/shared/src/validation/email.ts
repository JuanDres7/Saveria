import { z } from 'zod';

/** Se normaliza (espacios y mayúsculas) antes de validar el formato. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
