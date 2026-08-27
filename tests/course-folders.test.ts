import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFolderActivityIds, normalizeFolderColor, normalizeFolderDescription, normalizeFolderName } from '../lib/course-folders.ts';

test('normalise les informations d’un dossier pédagogique', () => {
  assert.equal(normalizeFolderName('  Sécurité   au travail  '),'Sécurité au travail');
  assert.equal(normalizeFolderDescription('  Un   parcours progressif. '),'Un parcours progressif.');
  assert.equal(normalizeFolderColor('blue'),'blue');
  assert.equal(normalizeFolderColor('inconnue'),'mint');
});

test('déduplique les activités tout en conservant leur ordre', () => {
  assert.deepEqual(normalizeFolderActivityIds(['activity-001','activity-002','activity-001','']),['activity-001','activity-002']);
});
