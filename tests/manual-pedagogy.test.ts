import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManualPedagogy } from '../lib/manual-pedagogy.ts';

test('compose un mini-cours structuré à partir des explications du quiz', () => {
  const result = buildManualPedagogy('quiz','Prévenir les chutes',['Identifier le risque'],{ questions:[{
    question:'Pourquoi baliser une zone humide ?',
    choices:['Pour prévenir les chutes','Pour parfumer la zone','Pour ranger le matériel'],
    correctIndex:0,
    explanation:'Le balisage protège les usagers du risque de chute.',
  }] });
  assert.match(result.explanation,/## Méthode pas à pas/);
  assert.match(result.explanation,/Le balisage protège les usagers/);
  assert.match(result.correction,/Question 1 — Pour prévenir les chutes/);
  assert.match(result.correction,/## Critères de réussite/);
});

test('utilise les objectifs lorsqu’une mécanique ne contient pas d’explication', () => {
  const result = buildManualPedagogy('word-search','Vocabulaire sécurité',['Reconnaître les équipements'],{ grid:['EPI'],words:['EPI'] });
  assert.match(result.explanation,/Reconnaître les équipements/);
  assert.match(result.correction,/Reconnaître les équipements/);
});
