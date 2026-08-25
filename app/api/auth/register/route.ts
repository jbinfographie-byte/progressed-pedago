import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { trainerAccessRequests, users } from '@/db/schema';
import { audit, createSession } from '@/lib/auth';
import { assertSameOrigin, cleanEmail, jsonError, jsonOk, readJson, AppError } from '@/lib/http';
import { hashPassword, timingSafeEqual, validatePassword } from '@/lib/security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const password = String(body.password ?? '');
    if (password !== String(body.passwordConfirmation ?? '')) throw new AppError(400, 'Les deux mots de passe ne correspondent pas.', 'PASSWORD_MISMATCH');
    const errors = validatePassword(password);
    if (errors.length) throw new AppError(400, errors.join(' '), 'WEAK_PASSWORD');
    const existing = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) throw new AppError(409, 'Un compte existe déjà avec cette adresse e-mail.', 'EMAIL_EXISTS');
    const wantsAdmin = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() === email;
    const adminAllowed = wantsAdmin && Boolean(env.INITIAL_ADMIN_BOOTSTRAP_TOKEN) && timingSafeEqual(String(body.bootstrapToken ?? ''), env.INITIAL_ADMIN_BOOTSTRAP_TOKEN ?? '');
    if (wantsAdmin && !adminAllowed) throw new AppError(403, 'Le jeton d’initialisation administrateur est invalide.', 'INVALID_BOOTSTRAP_TOKEN');
    const id = crypto.randomUUID();
    const passwordData = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    await getDb().batch([
      getDb().insert(users).values({ id, email, displayName: String(body.displayName ?? '').trim().slice(0, 100) || null, passwordHash: passwordData.hash, passwordSalt: passwordData.salt, role: adminAllowed ? 'admin' : 'trainer', status: adminAllowed ? 'active' : 'pending', activatedAt: adminAllowed ? now : null }),
      getDb().insert(trainerAccessRequests).values({ id: crypto.randomUUID(), trainerId: id, status: adminAllowed ? 'approved' : 'pending', decidedAt: adminAllowed ? now : null }),
    ]);
    await audit(id, adminAllowed ? 'admin.bootstrap' : 'trainer.requested_access', 'user', id, {}, request);
    if (adminAllowed) await createSession(id, request);
    return jsonOk({ status: adminAllowed ? 'active' : 'pending', message: adminAllowed ? 'Compte administrateur initialisé.' : 'Votre demande d’accès a été enregistrée.' }, 201);
  } catch (error) { return jsonError(error); }
}
