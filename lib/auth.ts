import { cookies } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditLogs, sessions, trainerPermissions, users } from '@/db/schema';
import { AppError } from '@/lib/http';
import { ALL_PERMISSIONS, normalizePermissions, permissionLabel, type PermissionKey, type TrainerPermissions } from '@/lib/permissions';
import { randomToken, sha256 } from '@/lib/security';

const SESSION_COOKIE = 'pp_session';
const SESSION_SECONDS = 12 * 60 * 60;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'trainer';
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  permissions: TrainerPermissions;
};

export async function createSession(userId: string, request: Request): Promise<void> {
  const token = randomToken(32);
  const db = getDb();
  await db.insert(sessions).values({
    id: crypto.randomUUID(), userId, tokenHash: await sha256(token), expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    ipHash: await requestFingerprint(request), userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_SECONDS });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().update(sessions).set({ revokedAt: Math.floor(Date.now() / 1000) }).where(eq(sessions.tokenHash, await sha256(token)));
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await getDb().select({ id: users.id, email: users.email, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName, role: users.role, status: users.status })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await sha256(token)), gt(sessions.expiresAt, Math.floor(Date.now() / 1000)), isNull(sessions.revokedAt))).limit(1);
  const user = rows[0];
  if (!user) return null;
  return { ...user, permissions: await getPermissionsForUser(user) };
}

export async function getPermissionsForUser(user: { id: string; role: 'admin' | 'trainer' }): Promise<TrainerPermissions> {
  if (user.role === 'admin') return { ...ALL_PERMISSIONS };
  const row = (await getDb().select({ permissionsJson: trainerPermissions.permissionsJson }).from(trainerPermissions).where(eq(trainerPermissions.trainerId, user.id)).limit(1))[0];
  return row ? normalizePermissions(row.permissionsJson) : normalizePermissions(null);
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, 'Votre session a expiré. Reconnectez-vous.', 'SESSION_EXPIRED');
  if (user.status === 'suspended') throw new AppError(403, 'Ce compte est temporairement suspendu.', 'ACCOUNT_SUSPENDED');
  if (user.status === 'revoked') throw new AppError(403, 'L’accès à ce compte a été révoqué.', 'ACCOUNT_REVOKED');
  if (user.status !== 'active') throw new AppError(403, 'Votre compte doit encore être activé.', 'ACCOUNT_PENDING');
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new AppError(403, 'Cette action est réservée à l’administration.', 'ADMIN_REQUIRED');
  return user;
}

export function assertPermission(user: AuthUser, permission: PermissionKey): void {
  if (!user.permissions[permission]) throw new AppError(403, `Votre profil ne permet pas de ${permissionLabel(permission).toLowerCase()}. Demandez ce droit à l’administrateur.`, 'PERMISSION_REQUIRED');
}

export async function requirePermission(permission: PermissionKey): Promise<AuthUser> {
  const user = await requireUser();
  assertPermission(user, permission);
  return user;
}

export async function audit(actorId: string | null, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}, request?: Request) {
  await getDb().insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action, targetType, targetId, metadataJson: JSON.stringify(metadata), ipHash: request ? await requestFingerprint(request) : null });
}

export async function requestFingerprint(request: Request): Promise<string> {
  const source = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  return sha256(source);
}
