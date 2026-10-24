import type { EmailTemplates } from '../../../application/ports/services';
import { resetPasswordMessage } from './reset-password';
import { verifyEmailMessage } from './verify-email';

/** Plantillas reales de los correos de Saveria. */
export const emailTemplates: EmailTemplates = {
  verifyEmail: verifyEmailMessage,
  resetPassword: resetPasswordMessage,
};
