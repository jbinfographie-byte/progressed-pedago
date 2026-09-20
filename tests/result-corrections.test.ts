import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResultCorrection } from '../lib/result-corrections.ts';

test('builds a full quiz correction from stored answer indexes', () => {
  const result = buildResultCorrection('quiz',{questions:[{question:'Porter des gants ?',choices:['Jamais','Selon le risque','Toujours les mêmes'],correctIndex:1,explanation:'Le gant doit être adapté au risque.'}]},[1]);
  assert.equal(result.items[0]?.correct,true);
  assert.equal(result.items[0]?.learnerAnswer,'Selon le risque');
  assert.equal(result.items[0]?.expectedAnswer,'Selon le risque');
});

test('builds an audio quiz correction without exposing the spoken text in the prompt', () => {
  const result = buildResultCorrection('audio-quiz',{items:[{spokenText:'Bonjour',question:'Quel mot avez-vous entendu ?',choices:['Au revoir','Bonjour'],correctIndex:1,explanation:'Bonjour est une salutation.'}]},[1]);
  assert.equal(result.items[0]?.correct,true);
  assert.match(result.items[0]?.prompt??'',/Écoute 1/);
  assert.equal(result.items[0]?.expectedAnswer,'Bonjour');
});

test('preserves the learner placements when correcting drag and drop', () => {
  const result = buildResultCorrection('drag-drop',{mode:'association',categories:[{id:'a',label:'Avant'},{id:'b',label:'Après'}],items:[{id:'one',label:'Baliser',category:'a',explanation:'Le balisage précède le lavage.'}]},[{itemId:'one',targetId:'b'}]);
  assert.equal(result.items[0]?.correct,false);
  assert.equal(result.items[0]?.learnerAnswer,'Après');
  assert.equal(result.items[0]?.expectedAnswer,'Avant');
});
