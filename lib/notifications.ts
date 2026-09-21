import { env } from '@/lib/runtime-env';

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !input.to) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [input.to], subject: input.subject.slice(0, 160), text: input.text.slice(0, 20_000) }),
    });
    return response.ok;
  } catch { return false; }
}
