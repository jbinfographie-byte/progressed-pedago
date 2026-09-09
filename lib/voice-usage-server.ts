import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiUsageEvents } from '@/db/schema';
import { AppError } from '@/lib/http';
import { recordAiUsage } from '@/lib/subscriptions-server';
import { normalizeVoiceCoachContent } from '@/lib/voice-coach';
import { isVoiceUsageSessionId, normalizeVoiceUsageSeconds, voiceUsageCredits } from '@/lib/voice-usage';

export async function finalizeVoiceUsage(input: {
  userId: string;
  activityId: string;
  activityContent: unknown;
  usageSessionId: unknown;
  durationSeconds: unknown;
  participantId?: string;
  pathItemId?: string;
  assignmentId?: string;
  maximumSeconds?: number;
}) {
  if (!isVoiceUsageSessionId(input.usageSessionId)) throw new AppError(400, 'La session vocale est invalide.', 'VOICE_USAGE_SESSION_INVALID');
  const started = (await getDb().select().from(aiUsageEvents).where(and(eq(aiUsageEvents.userId, input.userId), eq(aiUsageEvents.requestId, `voice-start:${input.usageSessionId}`), eq(aiUsageEvents.feature, 'voice_session_started'))).limit(1))[0];
  if (!started) throw new AppError(404, 'La session vocale à comptabiliser est introuvable.', 'VOICE_USAGE_SESSION_NOT_FOUND');
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(started.metadataJson) as Record<string, unknown>; } catch { metadata = {}; }
  if (metadata.activityId !== input.activityId || (input.participantId && metadata.participantId !== input.participantId) || (input.pathItemId && metadata.pathItemId !== input.pathItemId) || (input.assignmentId && metadata.assignmentId !== input.assignmentId)) throw new AppError(403, 'Cette session vocale ne correspond pas à cette activité.', 'VOICE_USAGE_SESSION_MISMATCH');
  const config = normalizeVoiceCoachContent(input.activityContent);
  const audioSeconds = normalizeVoiceUsageSeconds({ reportedSeconds: input.durationSeconds, startedAtSeconds: started.createdAt, maximumSeconds: Math.min(config.maxDurationMinutes * 60,input.maximumSeconds??Number.MAX_SAFE_INTEGER) });
  if (audioSeconds < 1) return { recorded: false, audioSeconds: 0 };
  const recorded = await recordAiUsage({
    userId: input.userId,
    feature: 'voice_coach',
    model: started.model,
    audioSeconds,
    creditsCharged: voiceUsageCredits(audioSeconds),
    requestId: `voice-complete:${input.usageSessionId}`,
    status: 'completed',
    metadata: { activityId: input.activityId, participantId: input.participantId ?? null, pathItemId: input.pathItemId ?? null, assignmentId: input.assignmentId ?? null },
  });
  return { recorded, audioSeconds };
}
