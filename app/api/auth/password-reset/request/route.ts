import { env } from '@/lib/runtime-env';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { passwordResetTokens, users } from '@/db/schema';
import { audit } from '@/lib/auth';
import { assertSameOrigin, cleanEmail, jsonError, jsonOk, readJson } from '@/lib/http';
import { randomToken, sha256 } from '@/lib/security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const user = (await getDb().select().from(users).where(eq(users.email,email)).limit(1))[0];
    let sent = false;
    if (user && user.status === 'active') {
      const token = randomToken(32);
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
      await getDb().insert(passwordResetTokens).values({ id:crypto.randomUUID(), userId:user.id, tokenHash:await sha256(`${token}${env.SECURITY_PEPPER}`), expiresAt });
      const siteUrl = String(env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/,'');
      const resetUrl = `${siteUrl}/?reset=${encodeURIComponent(token)}`;
      if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
        const response = await fetch('https://api.resend.com/emails',{ method:'POST', headers:{ Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json' }, body:JSON.stringify({ from:env.RESEND_FROM_EMAIL,to:[user.email],subject:'Réinitialiser votre mot de passe Progressed Pédago',text:`Bonjour,\n\nUtilisez ce lien dans les 30 minutes pour choisir un nouveau mot de passe :\n${resetUrl}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.` }) });
        sent = response.ok;
      }
      await audit(user.id,'auth.password_reset_requested','user',user.id,{ sent },request);
    }
    return jsonOk({ message:'Si ce compte est actif, un lien valable 30 minutes vient d’être envoyé. Vérifiez également vos courriers indésirables.' });
  } catch (error) { return jsonError(error); }
}
