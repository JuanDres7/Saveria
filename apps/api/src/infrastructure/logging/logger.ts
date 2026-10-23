import pino, { type DestinationStream, type Logger } from 'pino';

/** Campos que nunca deben llegar a un log (FR-026, SC-006). */
export const REDACTED_PATHS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordConfirmation',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'email',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.authorization',
  '*.email',
  'req.headers.authorization',
  'headers.authorization',
];

export function createLogger(level = 'info', destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    },
    destination,
  );
}

export type { Logger };
