import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_TEST: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1),
    JWT_SECRET: z
      .string()
      .refine((value) => Buffer.byteLength(value) >= 32, 'JWT_SECRET debe tener al menos 32 bytes'),
    PUBLIC_BASE_URL: z.url(),
    EMAIL_PROVIDER: z.enum(['dev-outbox', 'resend']).default('dev-outbox'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(1),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .refine((env) => env.EMAIL_PROVIDER !== 'resend' || !!env.RESEND_API_KEY, {
    message: 'RESEND_API_KEY es obligatoria cuando EMAIL_PROVIDER=resend',
    path: ['RESEND_API_KEY'],
  })
  // En producción, dev-outbox dejaría los enlaces de los correos en disco sin enviarlos.
  .refine((env) => env.NODE_ENV !== 'production' || env.EMAIL_PROVIDER !== 'dev-outbox', {
    message: 'en producción EMAIL_PROVIDER debe ser resend',
    path: ['EMAIL_PROVIDER'],
  })
  // Los enlaces de los correos llevan el token: por http viajarían sin cifrar.
  .refine((env) => env.NODE_ENV !== 'production' || env.PUBLIC_BASE_URL.startsWith('https://'), {
    message: 'en producción PUBLIC_BASE_URL debe usar https',
    path: ['PUBLIC_BASE_URL'],
  });

export type Config = z.infer<typeof envSchema>;

/** Lee y valida las variables de entorno; falla al arrancar si algo está mal. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Solo se informan los nombres de las variables y el motivo, nunca sus valores.
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${problems}`);
  }
  return result.data;
}
