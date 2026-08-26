import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { loginAttempts, users } from '@/db/schema';
import { audit, createSession, getPermissionsForUser, requestFingerprint } from '@/lib/auth';
import { AppError, assertSameOrigin, cleanEmail, jsonError, jsonOk, readJson } from '@/lib/http';
import { sha256, verifyPassword } from '@/lib/security';
import { migrateLegacyData } from '@/lib/legacy-migration';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const emailHash = await sha256(email);
    const since = Math.floor(Date.now() / 1000) - 15 * 60;
    const recent = await getDb().select({ count: sql<number>`count(*)` }).from(loginAttempts).where(and(eq(loginAttempts.emailHash, emailHash), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
    if (Number(recent[0]?.count ?? 0) >= 8) throw new AppError(429, 'Trop de tentatives. Réessayez dans 15 minutes.', 'RATE_LIMITED');
    const user = (await getDb().select().from(users).where(eq(users.email, email)).limit(1))[0];
    const success = Boolean(user && await verifyPassword(String(body.password ?? ''), user.passwordSalt, user.passwordHash));
    await getDb().insert(loginAttempts).values({ id: crypto.randomUUID(), emailHash, ipHash: await requestFingerprint(request), success });
    if (!success) throw new AppError(401, 'Adresse e-mail ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
    if (user.status === 'pending') throw new AppError(403, 'Votre demande est en attente de validation par l’administrateur.', 'ACCOUNT_PENDING');
    if (user.status === 'suspended') throw new AppError(403, 'Ce compte est temporairement suspendu.', 'ACCOUNT_SUSPENDED');
    if (user.status === 'revoked') throw new AppError(403, 'L’accès à ce compte a été révoqué.', 'ACCOUNT_REVOKED');
    await createSession(user.id, request);
    await getDb().update(users).set({ lastLoginAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000) }).where(eq(users.id, user.id));
    await audit(user.id, 'auth.login', 'user', user.id, {}, request);
    if (user.role === 'admin') { try { await migrateLegacyData(user.id); } catch (error) { console.error('Reprise des données historiques différée',error instanceof Error ? error.message : 'erreur inconnue'); } }
    return jsonOk({ user: { id: user.id, email: user.email, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status, permissions: await getPermissionsForUser(user) } });
  } catch (error) { return jsonError(error); }
}
