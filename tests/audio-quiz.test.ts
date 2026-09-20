import assert from 'node:assert/strict';
import test from 'node:test';
import { audioQuizFromLines, audioQuizValidationErrors, normalizeAudioQuizContent } from '../lib/audio-quiz.ts';

test('une liste de mots devient un quiz audio jouable avec des bonnes réponses variées', () => {
  const quiz = audioQuizFromLines('Bonjour\nMerci\nAu revoir\nBienvenue');
  assert.equal(quiz.items.length, 4);
  assert.deepEqual(quiz.items.map((item) => item.choices[item.correctIndex]), quiz.items.map((item) => item.spokenText));
  assert.ok(new Set(quiz.items.map((item) => item.correctIndex)).size > 1);
  assert.deepEqual(audioQuizValidationErrors(quiz), []);
});

test('la normalisation borne la vitesse et conserve le code de langue', () => {
  const quiz = normalizeAudioQuizContent({ language:'en-US',speechRate:5,items:[] });
  assert.equal(quiz.language, 'en-US');
  assert.equal(quiz.speechRate, 1.3);
});
