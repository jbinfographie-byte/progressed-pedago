import assert from 'node:assert/strict';
import test from 'node:test';
import { diversifyGeneratedAnswerPositions } from '../lib/quiz-answer-order.ts';

test('répartit les bonnes réponses entre A, B, C et D même si l IA renvoie toujours B', () => {
  const questions = Array.from({ length: 8 }, (_, index) => ({
    question: `Question ${index + 1}`,
    choices: [`Erreur A${index}`, `Bonne ${index}`, `Erreur C${index}`, `Erreur D${index}`],
    correctIndex: 1,
    explanation: `La bonne réponse est Bonne ${index}.`,
  }));

  const result = diversifyGeneratedAnswerPositions({ questions }, 'generation-video-1');
  const diversified = result.questions as typeof questions;
  const positions = diversified.map((question) => question.correctIndex);

  assert.deepEqual(new Set(positions), new Set([0, 1, 2, 3]));
  assert.deepEqual(
    diversified.map((question) => question.choices[question.correctIndex]),
    questions.map((question) => question.choices[question.correctIndex]),
  );
});

test('conserve un ordre stable pour une génération donnée', () => {
  const content = {
    questions: [{ question: 'Question', choices: ['A', 'Bonne réponse', 'C', 'D'], correctIndex: 1 }],
  };
  assert.deepEqual(
    diversifyGeneratedAnswerPositions(content, 'même-génération'),
    diversifyGeneratedAnswerPositions(content, 'même-génération'),
  );
});

test('répartit aussi les bonnes réponses d’un quiz audio', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    spokenText: `Expression ${index + 1}`,
    question: 'Quelle expression avez-vous entendue ?',
    choices: [`Erreur A${index}`, `Expression ${index + 1}`, `Erreur C${index}`, `Erreur D${index}`],
    correctIndex: 1,
    explanation: 'Correction audio.',
  }));

  const result = diversifyGeneratedAnswerPositions({ items }, 'quiz-audio-1');
  const diversified = result.items as typeof items;

  assert.deepEqual(new Set(diversified.map((item) => item.correctIndex)), new Set([0, 1, 2, 3]));
  assert.deepEqual(
    diversified.map((item) => item.choices[item.correctIndex]),
    items.map((item) => item.choices[item.correctIndex]),
  );
});

test('diversifie aussi les exercices de fin de leçon sans changer la réponse attendue', () => {
  const coursePages = Array.from({ length: 4 }, (_, index) => ({
    id: `page-${index + 1}`,
    practice: {
      type: 'quiz',
      choices: ['Distracteur A', `Réponse juste ${index}`, 'Distracteur C', 'Distracteur D'],
      correctIndex: 1,
      answer: `Réponse juste ${index}`,
    },
  }));

  const result = diversifyGeneratedAnswerPositions({ coursePages }, 'cours-pdf');
  const pages = result.coursePages as typeof coursePages;

  assert.deepEqual(new Set(pages.map((page) => page.practice.correctIndex)), new Set([0, 1, 2, 3]));
  for (let index = 0; index < pages.length; index++) {
    assert.equal(pages[index]!.practice.choices[pages[index]!.practice.correctIndex], `Réponse juste ${index}`);
    assert.equal(pages[index]!.practice.answer, `Réponse juste ${index}`);
  }
});

test('laisse intactes les mécaniques sans choix exploitables', () => {
  const content = { statements: [{ statement: 'Une affirmation', answer: true }] };
  assert.deepEqual(diversifyGeneratedAnswerPositions(content, 'sans-quiz'), content);
});
