declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    MASTER_ENCRYPTION_KEY: string;
    SECURITY_PEPPER: string;
    INITIAL_ADMIN_EMAIL?: string;
    INITIAL_ADMIN_BOOTSTRAP_TOKEN?: string;
    OPENAI_MODEL?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    NEXT_PUBLIC_SITE_URL?: string;
  }
}
