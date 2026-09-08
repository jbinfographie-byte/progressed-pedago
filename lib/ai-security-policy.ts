export const AI_SECURITY_DEFAULTS = {
  requestsPerMinute: 20,
  requestsPerDay: 150,
  globalRequestsPerDay: 2_000,
  globalDailyBudgetMicros: 25_000_000,
  maxJsonBytes: 250_000,
};

export type AiSecuritySettings = typeof AI_SECURITY_DEFAULTS;

export function normalizeAiSecuritySettings(value: Partial<AiSecuritySettings> = {}): AiSecuritySettings {
  const bounded = (candidate: unknown, fallback: number, max: number) => Number.isFinite(Number(candidate)) ? Math.min(max, Math.max(1, Math.round(Number(candidate)))) : fallback;
  return {
    requestsPerMinute: bounded(value.requestsPerMinute, AI_SECURITY_DEFAULTS.requestsPerMinute, 120),
    requestsPerDay: bounded(value.requestsPerDay, AI_SECURITY_DEFAULTS.requestsPerDay, 10_000),
    globalRequestsPerDay: bounded(value.globalRequestsPerDay, AI_SECURITY_DEFAULTS.globalRequestsPerDay, 100_000),
    globalDailyBudgetMicros: bounded(value.globalDailyBudgetMicros, AI_SECURITY_DEFAULTS.globalDailyBudgetMicros, 2_000_000_000),
    maxJsonBytes: bounded(value.maxJsonBytes, AI_SECURITY_DEFAULTS.maxJsonBytes, 1_000_000),
  };
}

export function safeOpenAiModel(value: unknown, fallback = 'gpt-5.5'): string {
  const requested = String(value ?? fallback).trim();
  const allowed = new Set(['gpt-5.4-mini', 'gpt-5.5', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol']);
  return allowed.has(requested) ? requested : 'gpt-5.5';
}
