import assert from 'node:assert/strict';
import test from 'node:test';
import { getInitialAdminEligibility } from '../lib/admin-bootstrap.ts';

const base = {
  email: 'admin@example.fr',
  configuredEmail: 'admin@example.fr',
  adminExists: false,
};

test('autorise le premier administrateur avec une identité Sites concordante', () => {
  assert.deepEqual(getInitialAdminEligibility({
    ...base,
    platformUserId: 'site-user-1',
    platformEmail: 'ADMIN@example.fr',
  }), {
    wantsAdmin: true,
    allowed: true,
    method: 'platform_identity',
    reason: null,
  });
});

test('refuse une identité Sites utilisant une autre adresse', () => {
  const result = getInitialAdminEligibility({
    ...base,
    platformUserId: 'site-user-2',
    platformEmail: 'autre@example.fr',
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'identity_required');
});

test('verrouille toute nouvelle initialisation après création du premier administrateur', () => {
  const result = getInitialAdminEligibility({
    ...base,
    adminExists: true,
    platformUserId: 'site-user-1',
    platformEmail: 'admin@example.fr',
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'already_initialized');
});

test('conserve le jeton hors interface comme solution de secours opérationnelle', () => {
  const result = getInitialAdminEligibility({
    ...base,
    submittedToken: 'Secret#2026',
    configuredToken: 'Secret#2026',
  });
  assert.equal(result.allowed, true);
  assert.equal(result.method, 'bootstrap_token');
});

test('une autre adresse reste une demande formateur', () => {
  const result = getInitialAdminEligibility({
    ...base,
    email: 'formateur@example.fr',
    platformUserId: 'site-user-3',
    platformEmail: 'formateur@example.fr',
  });
  assert.equal(result.wantsAdmin, false);
  assert.equal(result.allowed, false);
});
