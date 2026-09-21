import { objectStorage } from './object-storage';

export const env = {
  get CANVA_CLIENT_ID() { return process.env.CANVA_CLIENT_ID || ''; },
  get CANVA_CLIENT_SECRET() { return process.env.CANVA_CLIENT_SECRET || ''; },
  get GOOGLE_CLIENT_ID() { return process.env.GOOGLE_CLIENT_ID || ''; },
  get GOOGLE_CLIENT_SECRET() { return process.env.GOOGLE_CLIENT_SECRET || ''; },
  get INITIAL_ADMIN_BOOTSTRAP_TOKEN() { return process.env.INITIAL_ADMIN_BOOTSTRAP_TOKEN || ''; },
  get INITIAL_ADMIN_EMAIL() { return process.env.INITIAL_ADMIN_EMAIL || ''; },
  get MASTER_ENCRYPTION_KEY() { return process.env.MASTER_ENCRYPTION_KEY || ''; },
  get MICROSOFT_CLIENT_ID() { return process.env.MICROSOFT_CLIENT_ID || ''; },
  get MICROSOFT_CLIENT_SECRET() { return process.env.MICROSOFT_CLIENT_SECRET || ''; },
  get NEXT_PUBLIC_SITE_URL() { return process.env.NEXT_PUBLIC_SITE_URL || ''; },
  get NODE_ENV() { return process.env.NODE_ENV || 'production'; },
  get OPENAI_API_KEY() { return process.env.OPENAI_API_KEY || ''; },
  get OPENAI_MODEL() { return process.env.OPENAI_MODEL || ''; },
  get RESEND_API_KEY() { return process.env.RESEND_API_KEY || ''; },
  get RESEND_FROM_EMAIL() { return process.env.RESEND_FROM_EMAIL || ''; },
  get SECURITY_PEPPER() { return process.env.SECURITY_PEPPER || ''; },
  FILES: objectStorage,
};
