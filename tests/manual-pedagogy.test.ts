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

test('compose automatiquement le cours et la correction d’un glisser-déposer manuel', () => {
  const result = buildManualPedagogy('drag-drop','Documents professionnels',[],{
    categories:[{id:'definition-1',label:'Définition 1',description:'Décrit les tâches confiées à l’agent.'}],
    items:[{label:'Fiche de poste',category:'definition-1',explanation:'La fiche de poste cadre les missions du salarié.'}],
  });
  assert.match(result.explanation,/La fiche de poste cadre les missions/);
  assert.match(result.correction,/La fiche de poste cadre les missions/);
});

test('conserve l’ordre attendu dans la correction d’un classement manuel', () => {
  const result = buildManualPedagogy('ranking','Préparer une intervention',[],{items:[{label:'Préparer'},{label:'Baliser'},{label:'Contrôler'}]});
  assert.match(result.correction,/Préparer → Baliser → Contrôler/);
});
