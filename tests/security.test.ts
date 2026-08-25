import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret, hashPassword, validatePassword, verifyPassword } from '../lib/security.ts';

test('la politique de mot de passe impose les cinq critères', () => {
  assert.ok(validatePassword('court').length >= 4);
  assert.deepEqual(validatePassword('PhraseSolide#2026'), []);
});

test('le mot de passe est dérivé avec sel et vérifiable', async () => {
  const value = await hashPassword('PhraseSolide#2026');
  assert.notEqual(value.hash, 'PhraseSolide#2026');
  assert.match(value.hash, /^pbkdf2-sha256\$100000\$/);
  assert.equal(await verifyPassword('PhraseSolide#2026', value.salt, value.hash), true);
  assert.equal(await verifyPassword('Mauvais#2026', value.salt, value.hash), false);
});

test('une clé personnelle est chiffrée en AES-GCM et déchiffrable uniquement avec la clé maître', async () => {
  const master = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  const encrypted = await encryptSecret('sk-projet-personnel-123456789', master);
  assert.ok(!encrypted.ciphertext.includes('sk-projet'));
  assert.equal(await decryptSecret(encrypted.ciphertext, encrypted.iv, master), 'sk-projet-personnel-123456789');
});
