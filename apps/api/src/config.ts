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
