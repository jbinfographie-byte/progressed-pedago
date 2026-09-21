import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getUserEntitlement, recentUsage } from '@/lib/subscriptions-server';

export async function GET() {
  try {
    const user = await requireUser();
    const entitlement = await getUserEntitlement(user.id, user.role);
    const usage = await recentUsage(user.id, 12);
    return jsonOk({
      plan: { id: entitlement.plan.id, name: entitlement.plan.name },
      status: entitlement.subscription.status,
      startsAt: entitlement.subscription.startsAt,
      renewsAt: entitlement.subscription.renewsAt,
      endsAt: entitlement.subscription.endsAt,
      resetAt: entitlement.subscription.resetAt,
      unlimited: entitlement.unlimited,
      voice: {
        monthUsedSeconds: entitlement.subscription.voiceSecondsMonth,
        monthLimitSeconds: entitlement.monthlyVoiceLimit,
        dayUsedSeconds: entitlement.subscription.voiceSecondsDay,
        dayLimitSeconds: entitlement.dailyVoiceLimit,
        percent: entitlement.voicePercent,
        remainingSeconds: entitlement.unlimited ? null : Math.max(0, entitlement.monthlyVoiceLimit - entitlement.subscription.voiceSecondsMonth),
      },
      credits: { available: entitlement.unlimited ? null : entitlement.creditsAvailable },
      features: entitlement.features,
      alert: entitlement.alert,
      usage: usage.map((event) => ({ id: event.id, feature: event.feature, model: event.model, audioSeconds: event.audioSeconds, creditsCharged: event.creditsCharged, createdAt: event.createdAt })),
    });
  } catch (error) { return jsonError(error); }
}
