import { and, eq, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { learnerAssignments, learnerProfiles, users } from '@/db/schema';
import type { AuthUser } from '@/lib/auth';
import { AppError } from '@/lib/http';
import { normalizeVoiceSessionDurationSeconds } from '@/lib/voice-session-duration';

export function cleanText(value: unknown, max = 500): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function cleanOptionalEpoch(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new AppError(400, 'Une date transmise est invalide.', 'INVALID_DATE');
  return Math.floor(parsed);
}

export function cleanTrainingIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 100)).filter(Boolean))].slice(0, 100);
}

export async function assertStaffLearnerAccess(actor: AuthUser, learnerId: string) {
  if (actor.role === 'learner') throw new AppError(403, 'Accès refusé.', 'STAFF_REQUIRED');
  const row = (await getDb().select({
    id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
    displayName: users.displayName, status: users.status, role: users.role,
    organization: learnerProfiles.organization, groupName: learnerProfiles.groupName,
    assignedTrainerId: learnerProfiles.assignedTrainerId,
  }).from(users).leftJoin(learnerProfiles, eq(learnerProfiles.userId, users.id))
    .where(and(eq(users.id, learnerId), eq(users.role, 'learner'))).limit(1))[0];
  if (!row) throw new AppError(404, 'Cet apprenant est introuvable.', 'LEARNER_NOT_FOUND');
  if (actor.role === 'trainer' && row.assignedTrainerId !== actor.id) throw new AppError(403, 'Cet apprenant ne vous est pas attribué.', 'LEARNER_ACCESS_DENIED');
  return row;
}

export async function getActiveAssignment(learnerId: string, trainingId: string) {
  const now = Math.floor(Date.now() / 1000);
  const assignment = (await getDb().select().from(learnerAssignments).where(and(
    eq(learnerAssignments.learnerId, learnerId), eq(learnerAssignments.trainingId, trainingId),
    ne(learnerAssignments.status, 'removed'),
  )).limit(1))[0];
  if (!assignment || assignment.status === 'paused') throw new AppError(403, 'Ce parcours ne vous est pas accessible.', 'ASSIGNMENT_UNAVAILABLE');
  if (assignment.startsAt && assignment.startsAt > now) throw new AppError(403, 'Ce parcours n’est pas encore ouvert.', 'ASSIGNMENT_NOT_STARTED');
  if (assignment.dueAt && assignment.dueAt < now) throw new AppError(403, 'La date limite de ce parcours est dépassée.', 'ASSIGNMENT_EXPIRED');
  return assignment;
}

export async function upsertAssignment(input: {
  learnerId: string; trainingId: string; trainerId: string; startsAt?: number | null; dueAt?: number | null;
  orderMode?: 'sequential' | 'free'; maxAttempts?: number; resultVisible?: boolean; commentsVisible?: boolean;
  uploadAllowed?: boolean; chatAllowed?: boolean; voiceAllowed?: boolean; voiceDurationSeconds?: number; manualValidation?: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const values = {
    id: crypto.randomUUID(), learnerId: input.learnerId, trainingId: input.trainingId, trainerId: input.trainerId,
    startsAt: input.startsAt ?? null, dueAt: input.dueAt ?? null, status: 'active' as const,
    orderMode: input.orderMode ?? 'sequential' as const, maxAttempts: Math.min(100, Math.max(1, input.maxAttempts ?? 3)),
    resultVisible: input.resultVisible ?? true, commentsVisible: input.commentsVisible ?? true,
    uploadAllowed: input.uploadAllowed ?? true, chatAllowed: input.chatAllowed ?? true,
    voiceAllowed: input.voiceAllowed ?? true, voiceDurationSeconds: normalizeVoiceSessionDurationSeconds(input.voiceDurationSeconds),
    manualValidation: input.manualValidation ?? false, updatedAt: now,
  };
  await getDb().insert(learnerAssignments).values(values).onConflictDoUpdate({
    target: [learnerAssignments.learnerId, learnerAssignments.trainingId],
    set: {
      trainerId: values.trainerId, startsAt: values.startsAt, dueAt: values.dueAt, status: values.status,
      orderMode: values.orderMode, maxAttempts: values.maxAttempts, resultVisible: values.resultVisible,
      commentsVisible: values.commentsVisible, uploadAllowed: values.uploadAllowed, chatAllowed: values.chatAllowed,
      voiceAllowed: values.voiceAllowed, voiceDurationSeconds: values.voiceDurationSeconds,
      manualValidation: values.manualValidation, updatedAt: now,
    },
  });
}
