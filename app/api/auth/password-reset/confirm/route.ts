import { env } from '@/lib/runtime-env';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { passwordResetTokens, sessions, users } from '@/db/schema';
import { audit } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { hashPassword, sha256, validatePassword } from '@/lib/security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');
    if (password !== String(body.passwordConfirmation ?? '')) throw new AppError(400,'Les deux mots de passe ne correspondent pas.','PASSWORD_MISMATCH');
    const errors = validatePassword(password);
    if (errors.length) throw new AppError(400,errors.join(' '),'WEAK_PASSWORD');
    if (token.length < 32) throw new AppError(400,'Ce lien de réinitialisation est invalide ou a expiré.','INVALID_RESET_TOKEN');
    const tokenHash = await sha256(`${token}${env.SECURITY_PEPPER}`);
    const reset = (await getDb().select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash,tokenHash),gt(passwordResetTokens.expiresAt,Math.floor(Date.now()/1000)),isNull(passwordResetTokens.usedAt))).limit(1))[0];
    if (!reset) throw new AppError(400,'Ce lien de réinitialisation est invalide ou a expiré.','INVALID_RESET_TOKEN');
    const now = Math.floor(Date.now()/1000);
    const derived = await hashPassword(password);
    await getDb().batch([
      getDb().update(users).set({ passwordHash:derived.hash,passwordSalt:derived.salt,updatedAt:now }).where(eq(users.id,reset.userId)),
      getDb().update(passwordResetTokens).set({ usedAt:now }).where(eq(passwordResetTokens.id,reset.id)),
      getDb().update(sessions).set({ revokedAt:now }).where(and(eq(sessions.userId,reset.userId),isNull(sessions.revokedAt))),
    ]);
    await audit(reset.userId,'auth.password_reset_completed','user',reset.userId,{},request);
    return jsonOk({ message:'Votre mot de passe a été remplacé. Toutes vos anciennes sessions ont été fermées.' });
  } catch (error) { return jsonError(error); }
}
