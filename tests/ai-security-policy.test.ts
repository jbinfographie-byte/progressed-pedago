import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_SECURITY_DEFAULTS, chooseOpenAiCredentialSource, normalizeAiSecuritySettings, safeOpenAiModel } from '../lib/ai-security-policy.ts';

test('le modèle serveur est limité à la liste autorisée',()=>{
  assert.equal(safeOpenAiModel('gpt-5.6-terra'),'gpt-5.6-terra');
  assert.equal(safeOpenAiModel('modele-injecte'),'gpt-5.5');
});

test('les garde-fous IA sont bornés et conservent des valeurs sûres',()=>{
  const settings=normalizeAiSecuritySettings({requestsPerMinute:999,requestsPerDay:-5,globalDailyBudgetMicros:Number.NaN,maxJsonBytes:5_000_000});
  assert.equal(settings.requestsPerMinute,120);
  assert.equal(settings.requestsPerDay,1);
  assert.equal(settings.globalDailyBudgetMicros,AI_SECURITY_DEFAULTS.globalDailyBudgetMicros);
  assert.equal(settings.maxJsonBytes,1_000_000);
});

test('la connexion centrale reste prioritaire sur une ancienne clé personnelle',()=>{
  assert.equal(chooseOpenAiCredentialSource({hasPersonal:true,hasPlatform:true,hasAdministrator:true}),'platform');
  assert.equal(chooseOpenAiCredentialSource({hasPersonal:false,hasPlatform:true,hasAdministrator:true}),'platform');
  assert.equal(chooseOpenAiCredentialSource({hasPersonal:true,hasPlatform:false,hasAdministrator:true}),'administrator');
  assert.equal(chooseOpenAiCredentialSource({hasPersonal:false,hasPlatform:false,hasAdministrator:true}),'administrator');
  assert.equal(chooseOpenAiCredentialSource({hasPersonal:true,hasPlatform:false,hasAdministrator:false}),'personal');
  assert.equal(chooseOpenAiCredentialSource({hasPersonal:false,hasPlatform:false,hasAdministrator:false}),null);
});
