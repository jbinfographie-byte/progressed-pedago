import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFolderActivityIds,
  normalizeFolderColor,
  normalizeFolderCoverUrl,
  normalizeFolderDescription,
  normalizeFolderFileIds,
  normalizeFolderName,
  normalizeFolderTextList,
  normalizePathItemSettings,
  normalizeTrainingDuration,
  normalizeTrainingLevel,
  normalizeTrainingStatus,
} from '../lib/course-folders.ts';

test('normalise les informations d’un dossier pédagogique', () => {
  assert.equal(normalizeFolderName('  Sécurité   au travail  '),'Sécurité au travail');
  assert.equal(normalizeFolderDescription('  Un   parcours progressif. '),'Un parcours progressif.');
  assert.equal(normalizeFolderColor('blue'),'blue');
  assert.equal(normalizeFolderColor('inconnue'),'mint');
});

test('déduplique les activités tout en conservant leur ordre', () => {
  assert.deepEqual(normalizeFolderActivityIds(['activity-001','activity-002','activity-001','']),['activity-001','activity-002']);
});

test('normalise aussi les supports PowerPoint et documents du dossier', () => {
  assert.deepEqual(normalizeFolderFileIds(['file-pptx-001','file-pdf-002','file-pptx-001']),['file-pptx-001','file-pdf-002']);
});

test('normalise les métadonnées d’une formation', () => {
  assert.deepEqual(normalizeFolderTextList('Gestes métier, Sécurité\nGestes métier'),['Gestes métier','Sécurité']);
  assert.equal(normalizeFolderCoverUrl('https://example.com/couverture.jpg'),'https://example.com/couverture.jpg');
  assert.equal(normalizeFolderCoverUrl('http://example.com/couverture.jpg'),null);
  assert.equal(normalizeTrainingLevel('avance'),'avance');
  assert.equal(normalizeTrainingLevel('expert'),'debutant');
  assert.equal(normalizeTrainingStatus('published'),'published');
  assert.equal(normalizeTrainingStatus('inconnu'),'draft');
  assert.equal(normalizeTrainingDuration(0),5);
  assert.equal(normalizeTrainingDuration(9000),4800);
});

test('normalise les règles de progression du parcours sans changer l’ordre', () => {
  assert.deepEqual(normalizePathItemSettings([
    { activityId:'activity-002', required:false, minScore:130, unlockAfterPrevious:false },
    { activityId:'activity-001', minScore:72.6 },
    { activityId:'activity-002', minScore:20 },
    { activityId:'court' },
  ]),[
    { activityId:'activity-002', required:false, minScore:100, unlockAfterPrevious:false },
    { activityId:'activity-001', required:true, minScore:73, unlockAfterPrevious:true },
  ]);
});
