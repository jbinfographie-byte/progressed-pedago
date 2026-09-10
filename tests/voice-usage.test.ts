import test from 'node:test';
import assert from 'node:assert/strict';
import { isVoiceUsageSessionId, normalizeVoiceUsageSeconds, voiceUsageCredits } from '../lib/voice-usage.ts';

test('borne la consommation vocale à la durée réelle et à la durée de la séance',()=>{
  assert.equal(normalizeVoiceUsageSeconds({reportedSeconds:80,startedAtSeconds:1_000,maximumSeconds:600,nowSeconds:1_060}),75);
  assert.equal(normalizeVoiceUsageSeconds({reportedSeconds:900,startedAtSeconds:1_000,maximumSeconds:300,nowSeconds:2_000}),300);
  assert.equal(normalizeVoiceUsageSeconds({reportedSeconds:-10,startedAtSeconds:1_000,maximumSeconds:300,nowSeconds:1_020}),0);
});

test('calcule les crédits vocaux par minute commencée',()=>{
  assert.equal(voiceUsageCredits(0),0);
  assert.equal(voiceUsageCredits(1),2);
  assert.equal(voiceUsageCredits(60),2);
  assert.equal(voiceUsageCredits(61),4);
});

test('n’accepte que les identifiants de session générés côté serveur',()=>{
  assert.equal(isVoiceUsageSessionId('123e4567-e89b-42d3-a456-426614174000'),true);
  assert.equal(isVoiceUsageSessionId('session-libre'),false);
});
