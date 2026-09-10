import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTrainerAccessCode, trainerAccessCodeHint } from '../lib/access-codes.ts';

test('génère un code formateur lisible et suffisamment variable', () => {
  const codes = new Set(Array.from({ length: 50 }, generateTrainerAccessCode));
  assert.equal(codes.size, 50);
  for (const code of codes) assert.match(code, /^PP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});

test('ne conserve qu’un indice masqué dans le suivi administrateur', () => {
  assert.equal(trainerAccessCodeHint('PP-ABCD-EF67'), 'PP-••••-EF67');
});
