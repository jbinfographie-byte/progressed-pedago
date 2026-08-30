import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { learnerParticipants, learningPathItems, trainingShares } from '@/db/schema';
import { AppError } from '@/lib/app-error';
import { decryptSecret, sha256 } from '@/lib/security';

export type ShareMode = 'classroom' | 'home';
export type IdentityMode = 'name' | 'pseudonym' | 'learner_code' | 'anonymous';

export function normalizeShareSettings(body: Record<string, unknown>) {
  const mode: ShareMode = body.mode === 'classroom' ? 'classroom' : 'home';
  const liveActivityId = mode === 'classroom' ? String(body.liveActivityId ?? '').trim() || null : null;
  const identityMode: IdentityMode = body.identityMode === 'pseudonym' || body.identityMode === 'learner_code' || body.identityMode === 'anonymous' ? body.identityMode : 'name';
  const rawExpiry = String(body.expiresAt ?? '').trim(); let expiresAt: number | null = null;
  if (rawExpiry) { const value = Math.floor(new Date(rawExpiry).getTime() / 1000); if (!Number.isFinite(value) || value <= Math.floor(Date.now() / 1000) + 300) throw new AppError(400, 'Choisissez une expiration située dans plus de cinq minutes.', 'INVALID_SHARE_EXPIRY'); expiresAt = value; }
  const rawLimit = Number(body.maxAccesses); const maxAccesses = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 10_000) : null;
  return { mode, liveActivityId, identityMode, expiresAt, maxAccesses, sessionOpen: mode === 'home' || body.sessionOpen !== false };
}

export async function assertLiveActivityInPath(pathId: string, liveActivityId: string | null) {
  if (!liveActivityId) throw new AppError(400, 'Choisissez l’activité à ouvrir pendant le cours en direct.', 'LIVE_ACTIVITY_REQUIRED');
  const item = (await getDb().select({id:learningPathItems.id}).from(learningPathItems).where(and(eq(learningPathItems.pathId,pathId),eq(learningPathItems.activityId,liveActivityId))).limit(1))[0];
  if (!item) throw new AppError(400, 'Cette activité ne fait pas partie du parcours publié.', 'LIVE_ACTIVITY_NOT_IN_PATH');
}

export async function ownedShare(id: string, trainerId: string) {
  const share = (await getDb().select().from(trainingShares).where(and(eq(trainingShares.id, id), eq(trainingShares.trainerId, trainerId))).limit(1))[0];
  if (!share) throw new AppError(404, 'Ce lien de participation est introuvable.', 'SHARE_NOT_FOUND');
  return share;
}

export async function publicShare(token: string) {
  const tokenHash = await sha256(`${token}${env.SECURITY_PEPPER}`);
  const share = (await getDb().select().from(trainingShares).where(eq(trainingShares.tokenHash, tokenHash)).limit(1))[0];
  if (!share) throw new AppError(404, 'Ce lien de participation est invalide.', 'PUBLIC_SHARE_NOT_FOUND');
  assertShareAvailable(share);
  return share;
}

export function assertShareAvailable(share: typeof trainingShares.$inferSelect) {
  const now = Math.floor(Date.now() / 1000);
  if (share.status !== 'active') throw new AppError(410, 'Ce lien a été désactivé par le formateur.', 'SHARE_DISABLED');
  if (share.expiresAt && share.expiresAt <= now) throw new AppError(410, 'Ce lien de participation a expiré.', 'SHARE_EXPIRED');
  if (share.mode === 'classroom' && !share.sessionOpen) throw new AppError(423, 'La session en salle est actuellement fermée.', 'CLASSROOM_SESSION_CLOSED');
}

export async function sharePublicUrl(share: typeof trainingShares.$inferSelect, origin: string): Promise<string> {
  const token = await decryptSecret(share.tokenCiphertext, share.tokenIv, env.MASTER_ENCRYPTION_KEY);
  return `${String(env.NEXT_PUBLIC_SITE_URL ?? origin).replace(/\/$/,'')}/join/${encodeURIComponent(token)}`;
}

export function learnerCookieName(shortCode: string) { return `pp_learner_${shortCode.toLowerCase().replace(/[^a-z0-9]/g,'')}`.slice(0, 60); }

export async function currentParticipant(share: typeof trainingShares.$inferSelect) {
  const token = (await cookies()).get(learnerCookieName(share.shortCode))?.value;
  if (!token) return null;
  const browserTokenHash = await sha256(`${token}${env.SECURITY_PEPPER}`);
  return (await getDb().select().from(learnerParticipants).where(and(eq(learnerParticipants.shareId, share.id), eq(learnerParticipants.browserTokenHash, browserTokenHash))).limit(1))[0] ?? null;
}

export function participantDisplayName(identityMode: IdentityMode, body: Record<string, unknown>): string {
  if (identityMode === 'anonymous') return `Apprenant ${String(body.anonymousLabel ?? '').trim().slice(0, 12) || 'anonyme'}`;
  if (identityMode === 'name') {
    const firstName = cleanIdentity(body.firstName); const lastName = cleanIdentity(body.lastName);
    if (!firstName || !lastName) throw new AppError(400, 'Renseignez votre prénom et votre nom.', 'LEARNER_NAME_REQUIRED');
    return `${firstName} ${lastName}`;
  }
  const value = cleanIdentity(identityMode === 'pseudonym' ? body.pseudonym : body.learnerCode);
  if (!value) throw new AppError(400, identityMode === 'pseudonym' ? 'Renseignez un pseudonyme.' : 'Renseignez votre code apprenant.', 'LEARNER_IDENTITY_REQUIRED');
  return value;
}

export function splitDisplayName(value: string): { firstName: string; lastName: string } {
  const parts = value.split(/\s+/).filter(Boolean); return { firstName: parts.shift()?.slice(0,80) || 'Apprenant', lastName: parts.join(' ').slice(0,80) || '—' };
}

function cleanIdentity(value: unknown): string { return String(value ?? '').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0, 100); }
