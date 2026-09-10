import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { appSettings, creditTransactions, subscriptionEvents, subscriptionPlans, userFeatureOverrides, userSubscriptions, users } from '@/db/schema';
import { audit, requireAdmin } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { isPlanId, normalizeCreditCosts, normalizePlanFeatures, SUBSCRIPTION_FEATURES, type SubscriptionFeature } from '@/lib/subscriptions';
import { ensurePlanCatalog, ensureUserSubscription, getUserEntitlement, recentUsage } from '@/lib/subscriptions-server';
import { getAiSecuritySettings } from '@/lib/ai-security';

export async function GET() {
  try {
    await requireAdmin(); await ensurePlanCatalog();
    const planRows = await getDb().select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    const userRows = await getDb().select({ id: users.id, email: users.email, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName, role: users.role, status: users.status, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt));
    const members = [];
    for (const user of userRows) {
      const entitlement = await getUserEntitlement(user.id, user.role);
      const history = await getDb().select().from(subscriptionEvents).where(eq(subscriptionEvents.userId, user.id)).orderBy(desc(subscriptionEvents.createdAt)).limit(12);
      const usage = await recentUsage(user.id, 12);
      members.push({ ...user, entitlement: {
        planId: entitlement.plan.id, planName: entitlement.plan.name, subscriptionStatus: entitlement.subscription.status,
        startsAt: entitlement.subscription.startsAt, renewsAt: entitlement.subscription.renewsAt, endsAt: entitlement.subscription.endsAt,
        resetAt: entitlement.subscription.resetAt, updatedAt: entitlement.subscription.updatedAt, unlimited: entitlement.subscription.unlimited,
        creditsRemaining: entitlement.creditsAvailable, voiceSecondsMonth: entitlement.subscription.voiceSecondsMonth,
        voiceSecondsDay: entitlement.subscription.voiceSecondsDay, monthlyVoiceLimit: entitlement.monthlyVoiceLimit,
        dailyVoiceLimit: entitlement.dailyVoiceLimit, apiCostMicrosMonth: entitlement.subscription.apiCostMicrosMonth,
        apiBudgetMicros: entitlement.apiBudgetMicros, voicePercent: entitlement.voicePercent, apiPercent: entitlement.apiPercent,
        features: entitlement.features, overrides: entitlement.overrides,
      }, history, usage });
    }
    const totals = members.reduce((summary, member) => {
      summary.users += 1; summary.active += member.status === 'active' ? 1 : 0; summary.suspended += member.status === 'suspended' ? 1 : 0;
      summary.voiceSeconds += member.entitlement.voiceSecondsMonth; summary.apiCostMicros += member.entitlement.apiCostMicrosMonth;
      summary.creditsUsed += member.usage.reduce((sum, event) => sum + event.creditsCharged, 0);
      summary.nearLimit += member.entitlement.voicePercent >= 75 || member.entitlement.apiPercent >= 75 ? 1 : 0;
      summary.byPlan[member.entitlement.planId] = (summary.byPlan[member.entitlement.planId] ?? 0) + 1;
      return summary;
    }, { users: 0, active: 0, suspended: 0, voiceSeconds: 0, apiCostMicros: 0, creditsUsed: 0, nearLimit: 0, byPlan: {} as Record<string, number> });
    return jsonOk({ plans: planRows.map((plan) => ({ ...plan, features: normalizePlanFeatures(plan.featuresJson), creditCosts: normalizeCreditCosts(plan.creditCostsJson) })), members, totals, aiSecurity: await getAiSecuritySettings() });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const admin = await requireAdmin(); const body = await readJson(request);
    const action = String(body.action ?? ''); const userId = String(body.userId ?? ''); const now = Math.floor(Date.now() / 1000);
    if (action === 'update_ai_security') {
      const bounded = (value: unknown, fallback: number, maximum: number) => Number.isFinite(Number(value)) ? Math.min(maximum, Math.max(1, Math.round(Number(value)))) : fallback;
      const current = await getAiSecuritySettings();
      const settings = { requestsPerMinute: bounded(body.requestsPerMinute,current.requestsPerMinute,120), requestsPerDay: bounded(body.requestsPerDay,current.requestsPerDay,10_000), globalRequestsPerDay: bounded(body.globalRequestsPerDay,current.globalRequestsPerDay,100_000), globalDailyBudgetMicros: bounded(body.globalDailyBudgetMicros,current.globalDailyBudgetMicros,2_000_000_000), maxJsonBytes: bounded(body.maxJsonBytes,current.maxJsonBytes,1_000_000) };
      await getDb().insert(appSettings).values({key:'ai_security',valueJson:JSON.stringify(settings),updatedBy:admin.id,updatedAt:now}).onConflictDoUpdate({target:appSettings.key,set:{valueJson:JSON.stringify(settings),updatedBy:admin.id,updatedAt:now}});
      await audit(admin.id,'admin.updated_ai_security','app_setting','ai_security',settings,request);
      return jsonOk({message:'Les protections globales de l’IA ont été enregistrées.'});
    }
    if (action === 'update_plan_config') {
      const planId = body.planId; if (!isPlanId(planId)) throw new AppError(400, 'Formule inconnue.', 'PLAN_INVALID');
      const current = (await getDb().select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1))[0];
      if (!current) throw new AppError(404, 'Formule introuvable.', 'PLAN_NOT_FOUND');
      const integer = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback;
      const features = normalizePlanFeatures(body.features ?? current.featuresJson);
      const creditCosts = normalizeCreditCosts(body.creditCosts ?? current.creditCostsJson);
      await getDb().update(subscriptionPlans).set({ name: String(body.name ?? current.name).trim().slice(0, 80) || current.name, priceCents: integer(body.priceCents, current.priceCents), monthlyVoiceSeconds: integer(body.monthlyVoiceSeconds, current.monthlyVoiceSeconds), dailyVoiceSeconds: integer(body.dailyVoiceSeconds, current.dailyVoiceSeconds), monthlyCredits: integer(body.monthlyCredits, current.monthlyCredits), monthlyApiBudgetMicros: integer(body.monthlyApiBudgetMicros, current.monthlyApiBudgetMicros), featuresJson: JSON.stringify(features), creditCostsJson: JSON.stringify(creditCosts), active: body.active === undefined ? current.active : body.active === true, updatedAt: now }).where(eq(subscriptionPlans.id, planId));
      await audit(admin.id, 'admin.updated_subscription_plan', 'subscription_plan', planId, { features }, request);
      return jsonOk({ message: `La formule ${current.name} a été mise à jour.` });
    }
    const target = (await getDb().select({ id: users.id, role: users.role, displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!target) throw new AppError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND');
    await ensureUserSubscription(target.id, target.role);
    if (action === 'change_plan') {
      const planId = body.planId; if (!isPlanId(planId)) throw new AppError(400, 'Choisissez une formule valide.', 'PLAN_INVALID');
      const plan = (await getDb().select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.active, true))).limit(1))[0];
      if (!plan) throw new AppError(404, 'Cette formule est indisponible.', 'PLAN_NOT_FOUND');
      const current = (await getDb().select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1))[0]!;
      const status = String(body.status ?? current.status); const allowedStatuses = ['active', 'trial', 'free', 'suspended', 'expired', 'canceled'] as const;
      if (!allowedStatuses.includes(status as typeof allowedStatuses[number])) throw new AppError(400, 'Statut d’abonnement invalide.', 'SUBSCRIPTION_STATUS_INVALID');
      await getDb().batch([
        getDb().update(userSubscriptions).set({ planId, status: status as typeof allowedStatuses[number], startsAt: numberOrNull(body.startsAt) ?? current.startsAt, renewsAt: numberOrNull(body.renewsAt), endsAt: numberOrNull(body.endsAt), resetAt: numberOrNull(body.renewsAt) ?? current.resetAt, creditsRemaining: plan.monthlyCredits, updatedAt: now }).where(eq(userSubscriptions.userId, userId)),
        getDb().insert(subscriptionEvents).values({ id: crypto.randomUUID(), userId, actorId: admin.id, action: 'plan_changed', fromPlanId: current.planId, toPlanId: planId, metadataJson: JSON.stringify({ status }), createdAt: now }),
      ]);
      await audit(admin.id, 'admin.changed_user_plan', 'user', userId, { from: current.planId, to: planId, status }, request);
      const name = target.displayName || target.email;
      return jsonOk({ message: `La formule de ${name} a été modifiée de ${current.planId} vers ${plan.name}. Les nouveaux droits sont appliqués.` });
    }
    if (action === 'adjust_credits') {
      const amount = Math.round(Number(body.amount)); if (!Number.isFinite(amount) || amount === 0) throw new AppError(400, 'Indiquez un nombre de crédits positif ou négatif.', 'CREDIT_AMOUNT_INVALID');
      const current = (await getDb().select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1))[0]!;
      const total = current.creditsRemaining + current.extraCredits; const nextTotal = Math.max(0, total + amount); const applied = nextTotal - total;
      const nextExtra = Math.max(0, current.extraCredits + applied); const remainingRemoval = Math.max(0, -(current.extraCredits + applied));
      const nextMonthly = Math.max(0, current.creditsRemaining - remainingRemoval);
      await getDb().batch([
        getDb().update(userSubscriptions).set({ creditsRemaining: nextMonthly, extraCredits: nextExtra, updatedAt: now }).where(eq(userSubscriptions.userId, userId)),
        getDb().insert(creditTransactions).values({ id: crypto.randomUUID(), userId, amount: applied, balanceAfter: nextTotal, kind: 'admin_adjustment', label: String(body.label ?? 'Ajustement administrateur').slice(0, 200), actorId: admin.id, createdAt: now }),
        getDb().insert(subscriptionEvents).values({ id: crypto.randomUUID(), userId, actorId: admin.id, action: 'credits_adjusted', metadataJson: JSON.stringify({ amount: applied, balanceAfter: nextTotal }), createdAt: now }),
      ]);
      return jsonOk({ message: `${Math.abs(applied)} crédit(s) ${applied >= 0 ? 'ajouté(s)' : 'retiré(s)'}. Nouveau solde : ${nextTotal}.` });
    }
    if (action === 'update_override') {
      const feature = String(body.feature) as SubscriptionFeature;
      if (!SUBSCRIPTION_FEATURES.includes(feature)) throw new AppError(400, 'Fonctionnalité inconnue.', 'FEATURE_INVALID');
      if (body.allowed === null) await getDb().delete(userFeatureOverrides).where(and(eq(userFeatureOverrides.userId, userId), eq(userFeatureOverrides.feature, feature)));
      else await getDb().insert(userFeatureOverrides).values({ id: crypto.randomUUID(), userId, feature, allowed: body.allowed === true, expiresAt: numberOrNull(body.expiresAt), note: String(body.note ?? '').slice(0, 300), updatedBy: admin.id, updatedAt: now }).onConflictDoUpdate({ target: [userFeatureOverrides.userId, userFeatureOverrides.feature], set: { allowed: body.allowed === true, expiresAt: numberOrNull(body.expiresAt), note: String(body.note ?? '').slice(0, 300), updatedBy: admin.id, updatedAt: now } });
      await getDb().insert(subscriptionEvents).values({ id: crypto.randomUUID(), userId, actorId: admin.id, action: 'feature_override', metadataJson: JSON.stringify({ feature, allowed: body.allowed, expiresAt: numberOrNull(body.expiresAt) }), createdAt: now });
      return jsonOk({ message: body.allowed === null ? 'L’exception a été retirée.' : `L’accès « ${feature} » a été ${body.allowed === true ? 'accordé' : 'bloqué'}.` });
    }
    if (action === 'update_limits') {
      const update = { voiceMonthlyOverrideSeconds: optionalNonNegative(body.voiceMonthlyOverrideSeconds), voiceDailyOverrideSeconds: optionalNonNegative(body.voiceDailyOverrideSeconds), apiBudgetOverrideMicros: optionalNonNegative(body.apiBudgetOverrideMicros), creditsMonthlyOverride: optionalNonNegative(body.creditsMonthlyOverride), unlimited: body.unlimited === true, updatedAt: now };
      await getDb().update(userSubscriptions).set(update).where(eq(userSubscriptions.userId, userId));
      await getDb().insert(subscriptionEvents).values({ id: crypto.randomUUID(), userId, actorId: admin.id, action: 'limits_updated', metadataJson: JSON.stringify(update), createdAt: now });
      return jsonOk({ message: 'Les quotas personnalisés ont été enregistrés.' });
    }
    throw new AppError(400, 'Action administrateur inconnue.', 'BILLING_ACTION_INVALID');
  } catch (error) { return jsonError(error); }
}

function numberOrNull(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const number = Number(value); return Number.isFinite(number) ? Math.round(number) : null; }
function optionalNonNegative(value: unknown): number | null { const number = numberOrNull(value); return number === null ? null : Math.max(0, number); }
