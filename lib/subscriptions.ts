export const PLAN_IDS = ['essential', 'coach', 'intensive'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const SUBSCRIPTION_FEATURES = [
  'courses',
  'sheets',
  'quizzes',
  'basicExercises',
  'textAi',
  'voiceCoach',
  'professionalDialogues',
  'roleplays',
  'personalizedCorrections',
  'advancedGeneration',
  'premiumModels',
] as const;
export type SubscriptionFeature = (typeof SUBSCRIPTION_FEATURES)[number];
export type PlanFeatures = Record<SubscriptionFeature, boolean>;

export function hasUnlimitedAccess(role: 'admin' | 'trainer' | 'learner', storedUnlimited = false): boolean {
  return role === 'admin' || storedUnlimited;
}

export const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  courses: 'Cours',
  sheets: 'Fiches pédagogiques',
  quizzes: 'Quiz',
  basicExercises: 'Exercices',
  textAi: 'IA texte',
  voiceCoach: 'Coach vocal IA',
  professionalDialogues: 'Dialogues professionnels',
  roleplays: 'Jeux de rôle',
  personalizedCorrections: 'Corrections personnalisées',
  advancedGeneration: 'Génération pédagogique avancée',
  premiumModels: 'Modèles IA premium',
};

export type PlanConfiguration = {
  id: PlanId;
  name: string;
  priceCents: number;
  currency: string;
  monthlyVoiceSeconds: number;
  dailyVoiceSeconds: number;
  monthlyCredits: number;
  monthlyApiBudgetMicros: number;
  features: PlanFeatures;
  creditCosts: Record<string, number>;
  active: boolean;
  sortOrder: number;
};

function features(enabled: readonly SubscriptionFeature[]): PlanFeatures {
  const allowed = new Set(enabled);
  return Object.fromEntries(SUBSCRIPTION_FEATURES.map((feature) => [feature, allowed.has(feature)])) as PlanFeatures;
}

export const DEFAULT_PLAN_CONFIGURATIONS: ReadonlyArray<PlanConfiguration> = [
  {
    id: 'essential', name: 'Essentiel', priceCents: 1490, currency: 'EUR', monthlyVoiceSeconds: 30 * 60, dailyVoiceSeconds: 10 * 60,
    monthlyCredits: 100, monthlyApiBudgetMicros: 3_000_000, sortOrder: 1, active: true,
    features: features(['courses', 'sheets', 'quizzes', 'basicExercises', 'textAi', 'voiceCoach']),
    creditCosts: { textSimple: 1, exercise: 2, voiceMinute: 2, advanced: 5 },
  },
  {
    id: 'coach', name: 'Coach', priceCents: 2490, currency: 'EUR', monthlyVoiceSeconds: 90 * 60, dailyVoiceSeconds: 30 * 60,
    monthlyCredits: 300, monthlyApiBudgetMicros: 6_000_000, sortOrder: 2, active: true,
    features: features(['courses', 'sheets', 'quizzes', 'basicExercises', 'textAi', 'voiceCoach', 'professionalDialogues', 'roleplays', 'personalizedCorrections']),
    creditCosts: { textSimple: 1, exercise: 2, voiceMinute: 2, advanced: 5 },
  },
  {
    id: 'intensive', name: 'Intensif', priceCents: 3990, currency: 'EUR', monthlyVoiceSeconds: 180 * 60, dailyVoiceSeconds: 60 * 60,
    monthlyCredits: 600, monthlyApiBudgetMicros: 10_000_000, sortOrder: 3, active: true,
    features: features(SUBSCRIPTION_FEATURES),
    creditCosts: { textSimple: 1, exercise: 2, voiceMinute: 2, advanced: 5 },
  },
];

export function normalizePlanFeatures(value: unknown): PlanFeatures {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  return Object.fromEntries(SUBSCRIPTION_FEATURES.map((feature) => [feature, record[feature] === true])) as PlanFeatures;
}

export function normalizeCreditCosts(value: unknown): Record<string, number> {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(record).filter(([, amount]) => Number.isFinite(Number(amount)) && Number(amount) >= 0).map(([key, amount]) => [key, Math.round(Number(amount))]));
}

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export function usageAlert(percent: number): { level: 'normal' | 'warning' | 'danger' | 'blocked'; message: string } {
  if (percent >= 100) return { level: 'blocked', message: 'Votre quota vocal mensuel est atteint.' };
  if (percent >= 90) return { level: 'danger', message: 'Votre quota vocal est presque épuisé.' };
  if (percent >= 75) return { level: 'warning', message: 'Vous avez utilisé 75 % de votre quota vocal mensuel.' };
  return { level: 'normal', message: 'Votre quota vocal est disponible.' };
}

export function nextMonthlyReset(nowSeconds = Math.floor(Date.now() / 1000)): number {
  const current = new Date(nowSeconds * 1000);
  return Math.floor(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1) / 1000);
}

export function dayKey(nowSeconds = Math.floor(Date.now() / 1000)): string {
  return new Date(nowSeconds * 1000).toISOString().slice(0, 10);
}

export function monthKey(nowSeconds = Math.floor(Date.now() / 1000)): string {
  return new Date(nowSeconds * 1000).toISOString().slice(0, 7);
}

export function isPlanId(value: unknown): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export function routeAiTask(task: 'simple' | 'advanced', configuredModel: string): { model: string; tier: 'economical' | 'advanced' } {
  if (task === 'advanced') return { model: configuredModel, tier: 'advanced' };
  return { model: configuredModel, tier: 'economical' };
}
