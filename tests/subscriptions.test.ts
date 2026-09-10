import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAN_CONFIGURATIONS, nextMonthlyReset, normalizePlanFeatures, SUBSCRIPTION_FEATURES, usageAlert, usagePercent } from '../lib/subscriptions.ts';

test('les trois formules sont configurables et cumulatives', () => {
  assert.deepEqual(DEFAULT_PLAN_CONFIGURATIONS.map((plan) => plan.id), ['essential','coach','intensive']);
  const essential = DEFAULT_PLAN_CONFIGURATIONS[0]!;
  const coach = DEFAULT_PLAN_CONFIGURATIONS[1]!;
  const intensive = DEFAULT_PLAN_CONFIGURATIONS[2]!;
  assert.equal(essential.features.voiceCoach, true);
  assert.equal(essential.features.professionalDialogues, false);
  assert.equal(coach.features.voiceCoach, true);
  assert.ok(intensive.monthlyVoiceSeconds > coach.monthlyVoiceSeconds);
  assert.ok(intensive.monthlyCredits > essential.monthlyCredits);
  assert.ok(SUBSCRIPTION_FEATURES.every((feature) => intensive.features[feature]));
});

test('les pourcentages et alertes de quota restent bornés', () => {
  assert.equal(usagePercent(42,90), 47);
  assert.equal(usagePercent(120,90), 100);
  assert.equal(usageAlert(74).level, 'normal');
  assert.equal(usageAlert(75).level, 'warning');
  assert.equal(usageAlert(90).level, 'danger');
  assert.equal(usageAlert(100).level, 'blocked');
});

test('les permissions de formule ignorent les clés inconnues', () => {
  const normalized = normalizePlanFeatures({ courses:true,voiceCoach:true,dangerous:true });
  assert.equal(normalized.courses, true);
  assert.equal(normalized.voiceCoach, true);
  assert.equal('dangerous' in normalized, false);
  assert.equal(Object.keys(normalized).length, SUBSCRIPTION_FEATURES.length);
});

test('la prochaine remise à zéro tombe au premier du mois suivant', () => {
  const current = Math.floor(Date.UTC(2026,8,15,10,0,0)/1000);
  assert.equal(new Date(nextMonthlyReset(current)*1000).toISOString(),'2026-10-01T00:00:00.000Z');
});
