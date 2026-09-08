import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiUsageEvents, creditTransactions, subscriptionPlans, userFeatureOverrides, userSubscriptions } from '@/db/schema';
import { AppError } from '@/lib/http';
import { getAiSecuritySettings } from '@/lib/ai-security';
import {
  DEFAULT_PLAN_CONFIGURATIONS,
  dayKey,
  FEATURE_LABELS,
  monthKey,
  nextMonthlyReset,
  normalizeCreditCosts,
  normalizePlanFeatures,
  type PlanId,
  type SubscriptionFeature,
  usageAlert,
  usagePercent,
} from '@/lib/subscriptions';

export async function ensurePlanCatalog(): Promise<void> {
  for (const plan of DEFAULT_PLAN_CONFIGURATIONS) {
    await getDb().insert(subscriptionPlans).values({
      id: plan.id, name: plan.name, priceCents: plan.priceCents, currency: plan.currency,
      monthlyVoiceSeconds: plan.monthlyVoiceSeconds, dailyVoiceSeconds: plan.dailyVoiceSeconds,
      monthlyCredits: plan.monthlyCredits, monthlyApiBudgetMicros: plan.monthlyApiBudgetMicros,
      featuresJson: JSON.stringify(plan.features), creditCostsJson: JSON.stringify(plan.creditCosts), active: plan.active, sortOrder: plan.sortOrder,
    }).onConflictDoNothing();
  }
}

export async function ensureUserSubscription(userId: string, role: 'admin' | 'trainer'): Promise<void> {
  await ensurePlanCatalog();
  const existing = await getDb().select({ userId: userSubscriptions.userId }).from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
  if (existing.length) return;
  const planId: PlanId = role === 'admin' ? 'intensive' : 'essential';
  const plan = DEFAULT_PLAN_CONFIGURATIONS.find((item) => item.id === planId)!;
  const now = Math.floor(Date.now() / 1000);
  await getDb().insert(userSubscriptions).values({ userId, planId, status: role === 'admin' ? 'active' : 'free', startsAt: now, renewsAt: nextMonthlyReset(now), resetAt: nextMonthlyReset(now), creditsRemaining: plan.monthlyCredits, dayKey: dayKey(now), monthKey: monthKey(now), unlimited: role === 'admin' }).onConflictDoNothing();
}

async function resetUsageIfNeeded(userId: string): Promise<void> {
  const subscription = (await getDb().select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1))[0];
  if (!subscription) return;
  const plan = (await getDb().select().from(subscriptionPlans).where(eq(subscriptionPlans.id, subscription.planId)).limit(1))[0];
  if (!plan) return;
  const now = Math.floor(Date.now() / 1000); const today = dayKey(now); const month = monthKey(now);
  const resetMonth = subscription.resetAt <= now || subscription.monthKey !== month;
  const resetDay = subscription.dayKey !== today;
  if (!resetMonth && !resetDay) return;
  await getDb().update(userSubscriptions).set({
    ...(resetMonth ? { voiceSecondsMonth: 0, apiCostMicrosMonth: 0, creditsRemaining: subscription.creditsMonthlyOverride ?? plan.monthlyCredits, monthKey: month, resetAt: nextMonthlyReset(now), renewsAt: nextMonthlyReset(now) } : {}),
    ...(resetDay ? { voiceSecondsDay: 0, dayKey: today } : {}),
    updatedAt: now,
  }).where(eq(userSubscriptions.userId, userId));
  if (resetMonth) { const monthlyCredits = subscription.creditsMonthlyOverride ?? plan.monthlyCredits; await getDb().insert(creditTransactions).values({ id: crypto.randomUUID(), userId, amount: monthlyCredits, balanceAfter: monthlyCredits + subscription.extraCredits, kind: 'monthly_reset', label: `Remise à zéro ${month}` }); }
}

export async function getUserEntitlement(userId: string, role: 'admin' | 'trainer') {
  await ensureUserSubscription(userId, role); await resetUsageIfNeeded(userId);
  const row = (await getDb().select({ subscription: userSubscriptions, plan: subscriptionPlans }).from(userSubscriptions).innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id)).where(eq(userSubscriptions.userId, userId)).limit(1))[0];
  if (!row) throw new AppError(500, 'La formule du compte est indisponible.', 'SUBSCRIPTION_MISSING');
  const now = Math.floor(Date.now() / 1000);
  const overrides = await getDb().select().from(userFeatureOverrides).where(and(eq(userFeatureOverrides.userId, userId), or(isNull(userFeatureOverrides.expiresAt), gt(userFeatureOverrides.expiresAt, now))));
  const features = normalizePlanFeatures(row.plan.featuresJson);
  for (const override of overrides) if (override.feature in features) features[override.feature as SubscriptionFeature] = override.allowed;
  const expired = row.subscription.endsAt !== null && row.subscription.endsAt <= now;
  const usable = role === 'admin' || (!expired && ['active', 'trial', 'free'].includes(row.subscription.status));
  if (!usable) for (const feature of Object.keys(features) as SubscriptionFeature[]) features[feature] = ['courses', 'sheets', 'quizzes', 'basicExercises'].includes(feature);
  const monthlyVoiceLimit = row.subscription.unlimited ? Number.MAX_SAFE_INTEGER : row.subscription.voiceMonthlyOverrideSeconds ?? row.plan.monthlyVoiceSeconds;
  const dailyVoiceLimit = row.subscription.unlimited ? Number.MAX_SAFE_INTEGER : row.subscription.voiceDailyOverrideSeconds ?? row.plan.dailyVoiceSeconds;
  const creditsAvailable = row.subscription.unlimited ? Number.MAX_SAFE_INTEGER : row.subscription.creditsRemaining + row.subscription.extraCredits;
  const voicePercent = row.subscription.unlimited ? 0 : usagePercent(row.subscription.voiceSecondsMonth, monthlyVoiceLimit);
  const apiBudgetMicros = row.subscription.apiBudgetOverrideMicros ?? row.plan.monthlyApiBudgetMicros;
  const apiPercent = row.subscription.unlimited ? 0 : usagePercent(row.subscription.apiCostMicrosMonth, apiBudgetMicros);
  return {
    userId, plan: { ...row.plan, features, creditCosts: normalizeCreditCosts(row.plan.creditCostsJson) }, subscription: row.subscription,
    features, overrides, expired, usable, monthlyVoiceLimit, dailyVoiceLimit, creditsAvailable, apiBudgetMicros, voicePercent, apiPercent,
    alert: usageAlert(voicePercent),
  };
}

export async function assertSubscriptionFeature(userId: string, role: 'admin' | 'trainer', feature: SubscriptionFeature) {
  const entitlement = await getUserEntitlement(userId, role);
  if (!entitlement.features[feature]) throw new AppError(403, `${FEATURE_LABELS[feature]} n’est pas inclus dans votre formule actuelle.`, 'PLAN_FEATURE_REQUIRED');
  return entitlement;
}

export async function preflightAiUsage(userId: string, role: 'admin' | 'trainer', feature: SubscriptionFeature, options: { voice?: boolean; minimumCredits?: number } = {}) {
  const entitlement = await assertSubscriptionFeature(userId, role, feature);
  const now = Math.floor(Date.now() / 1000);
  const settings = await getAiSecuritySettings();
  const [recent, daily, globalDaily, globalCost] = await Promise.all([
    getDb().select({ id: aiUsageEvents.id }).from(aiUsageEvents).where(and(eq(aiUsageEvents.userId, userId),eq(aiUsageEvents.status,'started'), gt(aiUsageEvents.createdAt, now - 60))).limit(settings.requestsPerMinute + 1),
    getDb().select({ id: aiUsageEvents.id }).from(aiUsageEvents).where(and(eq(aiUsageEvents.userId, userId),eq(aiUsageEvents.status,'started'), gt(aiUsageEvents.createdAt, now - 86_400))).limit(settings.requestsPerDay + 1),
    getDb().select({ id: aiUsageEvents.id }).from(aiUsageEvents).where(and(eq(aiUsageEvents.status,'started'),gt(aiUsageEvents.createdAt, now - 86_400))).limit(settings.globalRequestsPerDay + 1),
    getDb().select({ total: sql<number>`coalesce(sum(coalesce(${aiUsageEvents.actualCostMicros}, ${aiUsageEvents.estimatedCostMicros})), 0)` }).from(aiUsageEvents).where(gt(aiUsageEvents.createdAt, now - 86_400)),
  ]);
  if (recent.length >= settings.requestsPerMinute) throw new AppError(429, 'Trop de demandes ont été envoyées. Patientez une minute avant de réessayer.', 'AI_RATE_LIMIT');
  if (daily.length >= settings.requestsPerDay) throw new AppError(429, 'Votre limite d’utilisation pour aujourd’hui est atteinte. Vous pourrez réessayer demain.', 'AI_DAILY_LIMIT_REACHED');
  if (globalDaily.length >= settings.globalRequestsPerDay || Number(globalCost[0]?.total ?? 0) >= settings.globalDailyBudgetMicros) throw new AppError(503, 'Les fonctions IA sont temporairement en pause par mesure de sécurité. Les contenus déjà créés restent disponibles.', 'AI_GLOBAL_SAFETY_LIMIT');
  await getDb().insert(aiUsageEvents).values({ id: crypto.randomUUID(), userId, feature: `${feature}_request`, status: 'started', requestId: `preflight:${crypto.randomUUID()}`, metadataJson: JSON.stringify({ voice: options.voice === true }), createdAt: now });
  if (entitlement.subscription.unlimited) return entitlement;
  if (entitlement.creditsAvailable < (options.minimumCredits ?? 1)) throw new AppError(429, 'Votre solde de crédits IA est épuisé. Les contenus déjà créés restent disponibles.', 'AI_CREDITS_EXHAUSTED');
  if (entitlement.apiBudgetMicros > 0 && entitlement.subscription.apiCostMicrosMonth >= entitlement.apiBudgetMicros) throw new AppError(429, 'La limite mensuelle des fonctions IA dynamiques est atteinte. Les cours et exercices déjà créés restent disponibles.', 'AI_BUDGET_REACHED');
  if (options.voice && (entitlement.subscription.voiceSecondsMonth >= entitlement.monthlyVoiceLimit || entitlement.subscription.voiceSecondsDay >= entitlement.dailyVoiceLimit)) throw new AppError(429, 'Votre quota vocal est atteint. Vous pouvez continuer en mode texte jusqu’au renouvellement.', 'VOICE_QUOTA_REACHED');
  return entitlement;
}

export async function recordAiUsage(input: { userId: string; feature: string; model?: string; inputTokens?: number; outputTokens?: number; audioSeconds?: number; estimatedCostMicros?: number; actualCostMicros?: number | null; creditsCharged?: number; requestId?: string; status?: 'started' | 'completed' | 'failed' | 'blocked'; metadata?: Record<string, unknown> }): Promise<boolean> {
  if (input.requestId) {
    const existing = await getDb().select({ id: aiUsageEvents.id }).from(aiUsageEvents).where(eq(aiUsageEvents.requestId, input.requestId)).limit(1);
    if (existing.length) return false;
  }
  const subscription = (await getDb().select().from(userSubscriptions).where(eq(userSubscriptions.userId, input.userId)).limit(1))[0];
  if (!subscription) return false;
  const audioSeconds = Math.max(0, Math.round(input.audioSeconds ?? 0));
  const credits = Math.max(0, Math.round(input.creditsCharged ?? 0));
  const cost = Math.max(0, Math.round(input.actualCostMicros ?? input.estimatedCostMicros ?? 0));
  const fromMonthly = Math.min(subscription.creditsRemaining, credits);
  const fromExtra = Math.max(0, credits - fromMonthly);
  const nextMonthly = Math.max(0, subscription.creditsRemaining - fromMonthly);
  const nextExtra = Math.max(0, subscription.extraCredits - fromExtra);
  const now = Math.floor(Date.now() / 1000);
  await getDb().batch([
    getDb().insert(aiUsageEvents).values({ id: crypto.randomUUID(), userId: input.userId, feature: input.feature, model: input.model ?? '', inputTokens: Math.max(0, Math.round(input.inputTokens ?? 0)), outputTokens: Math.max(0, Math.round(input.outputTokens ?? 0)), audioSeconds, estimatedCostMicros: Math.max(0, Math.round(input.estimatedCostMicros ?? 0)), actualCostMicros: input.actualCostMicros ?? null, creditsCharged: credits, requestId: input.requestId, status: input.status ?? 'completed', metadataJson: JSON.stringify(input.metadata ?? {}), createdAt: now }),
    getDb().update(userSubscriptions).set({ creditsRemaining: nextMonthly, extraCredits: nextExtra, voiceSecondsMonth: sql`${userSubscriptions.voiceSecondsMonth} + ${audioSeconds}`, voiceSecondsDay: sql`${userSubscriptions.voiceSecondsDay} + ${audioSeconds}`, apiCostMicrosMonth: sql`${userSubscriptions.apiCostMicrosMonth} + ${cost}`, updatedAt: now }).where(eq(userSubscriptions.userId, input.userId)),
    ...(credits ? [getDb().insert(creditTransactions).values({ id: crypto.randomUUID(), userId: input.userId, amount: -credits, balanceAfter: nextMonthly + nextExtra, kind: 'usage' as const, label: input.feature, metadataJson: JSON.stringify({ requestId: input.requestId ?? null }), createdAt: now })] : []),
  ]);
  return true;
}

export async function recentUsage(userId: string, limit = 50) {
  return getDb().select().from(aiUsageEvents).where(eq(aiUsageEvents.userId, userId)).orderBy(desc(aiUsageEvents.createdAt)).limit(limit);
}
