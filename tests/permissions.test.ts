import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPermissionLevel, normalizePermissions, PERMISSION_KEYS, PERMISSION_PRESETS } from '../lib/permissions.ts';

test('les profils limité, moyen et étendu sont reconnus', () => {
  assert.equal(detectPermissionLevel(PERMISSION_PRESETS.limited), 'limited');
  assert.equal(detectPermissionLevel(PERMISSION_PRESETS.medium), 'medium');
  assert.equal(detectPermissionLevel(PERMISSION_PRESETS.extended), 'extended');
});

test('une case modifiée produit un profil personnalisé', () => {
  assert.equal(detectPermissionLevel({ ...PERMISSION_PRESETS.medium, useAi: true }), 'custom');
});

test('les données inconnues sont normalisées vers des droits refusés', () => {
  const permissions = normalizePermissions('{"createActivities":true,"dangerousPermission":true}');
  assert.equal(permissions.createActivities, true);
  assert.equal(permissions.deleteActivities, false);
  assert.equal(Object.keys(permissions).length, PERMISSION_KEYS.length);
  assert.equal('dangerousPermission' in permissions, false);
});

test('le profil étendu active toutes les autorisations', () => {
  assert.ok(PERMISSION_KEYS.every((permission) => PERMISSION_PRESETS.extended[permission]));
});
