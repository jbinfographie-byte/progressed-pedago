import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedItemsByTarget, normalizeDragDropContent } from '../lib/drag-drop.ts';

test('normalise une association étiquette-définition et conserve les explications', () => {
  const game = normalizeDragDropContent({
    mode:'association',
    categories:[
      { id:'definition-1',label:'Définition 1',description:'Décrit les tâches à réaliser.' },
      { id:'definition-2',label:'Définition 2',description:'Transmet les informations du site.' },
    ],
    items:[
      { id:'fiche',label:'Fiche de poste',category:'definition-1',explanation:'Elle cadre les missions.' },
      { id:'liaison',label:'Cahier de liaison',category:'definition-2',explanation:'Il assure la transmission.' },
    ],
  });
  assert.equal(game.mode,'association');
  assert.equal(game.targets[0].description,'Décrit les tâches à réaliser.');
  assert.equal(expectedItemsByTarget(game)['definition-2'][0].label,'Cahier de liaison');
  assert.equal(game.items[0].explanation,'Elle cadre les missions.');
});

test('détecte automatiquement une activité visuelle et rattache les anciennes catégories par libellé', () => {
  const game = normalizeDragDropContent({
    zones:[
      { label:'Inflammable',imageUrl:'https://example.test/flame.png' },
      { label:'Corrosif',imageUrl:'https://example.test/corrosive.png' },
    ],
    items:[
      { label:'Flamme',category:'Inflammable' },
      { label:'Éprouvettes',category:'Corrosif' },
    ],
  });
  assert.equal(game.mode,'visual');
  assert.equal(game.items[0].targetId,game.targets[0].id);
  assert.equal(expectedItemsByTarget(game)[game.targets[1].id][0].label,'Éprouvettes');
});

test('conserve le mode classement lorsque plusieurs étiquettes vont dans une même zone', () => {
  const game = normalizeDragDropContent({
    categories:[{ label:'Avant' },{ label:'Après' }],
    items:[
      { label:'Préparer',category:'Avant' },
      { label:'Baliser',category:'Avant' },
      { label:'Contrôler',category:'Après' },
    ],
  });
  assert.equal(game.mode,'categories');
  assert.equal(expectedItemsByTarget(game)[game.targets[0].id].length,2);
});
