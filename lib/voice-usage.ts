export function normalizeVoiceUsageSeconds(input: {
  reportedSeconds: unknown;
  startedAtSeconds: number;
  maximumSeconds: number;
  nowSeconds?: number;
}): number {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const reported = Math.max(0, Math.round(Number(input.reportedSeconds) || 0));
  const elapsed = Math.max(0, now - Math.max(0, Math.round(input.startedAtSeconds)));
  const maximum = Math.max(1, Math.round(input.maximumSeconds));
  return Math.min(reported, elapsed + 15, maximum);
}

export function voiceUsageCredits(audioSeconds: number): number {
  const seconds = Math.max(0, Math.round(audioSeconds));
  return seconds > 0 ? Math.ceil(seconds / 60) * 2 : 0;
}

export function isVoiceUsageSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
