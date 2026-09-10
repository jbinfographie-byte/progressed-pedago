export const VOICE_SESSION_DURATION_MINUTES = [2, 3, 4, 5, 6, 10, 15, 20] as const;

export const DEFAULT_VOICE_SESSION_DURATION_SECONDS = 10 * 60;

export function normalizeVoiceSessionDurationSeconds(value: unknown): number {
  const seconds = Math.round(Number(value));
  return VOICE_SESSION_DURATION_MINUTES.some((minutes) => minutes * 60 === seconds)
    ? seconds
    : DEFAULT_VOICE_SESSION_DURATION_SECONDS;
}
