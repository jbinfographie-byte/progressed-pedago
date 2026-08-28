import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_TYPES, CREATABLE_ACTIVITY_TYPES, isCreatableActivityType, normalizeAnswer, validateActivityDraft, validateMechanic, type ActivityType } from '../lib/activity-types.ts';
import { SCENARIO_EXAMPLE_CONTENT, validateScenarioContent } from '../lib/scenario.ts';

function validContent(type: ActivityType): Record<string, unknown> {
  if (type === 'quiz' || type === 'tv-quiz') return { questions: [{ question: 'Q', choices: ['A','B'], correctIndex: 0 }] };
  if (type === 'true-false') return { statements: [{ text: 'A', answer: true }] };
  if (type === 'word-search') return { grid: ['ABC'], words: ['ABC'] };
  if (type === 'crossword') return { grid: ['...'], clues: [{ label: 'Indice' }] };
  if (type === 'hangman') return { words: ['SECURITE'] };
  if (['flip-tiles','revision-cards','random-cards','memory-cards','pair-or-not'].includes(type)) return { cards: [{ front: 'A', back: 'B' }] };
  if (type === 'type-answer') return { prompts: [{ question: 'Q', answer: 'A' }] };
  if (type === 'interactive-image') return { imageUrl: 'https://example.test/image.png', hotspots: [{ label: 'Zone' }] };
  if (type === 'scenario') return SCENARIO_EXAMPLE_CONTENT as unknown as Record<string,unknown>;
  if (type === 'live-poll') return { question: 'Q', options: ['A','B'] };
  if (type === 'challenge-wheel' || type === 'question-wheel') return { sectors: [{ label: 'A' },{ label: 'B' }] };
  if (type === 'categories') return { categories: [{ label: 'A' },{ label: 'B' }], items: [{ label: '1' },{ label: '2' }] };
  if (type === 'maze') return { cells: [{},{},{},{}] };
  if (type === 'flying-fruits') return { prompts: [{ question: 'Q' }] };
  return { items: [{ label: 'A' },{ label: 'B' }] };
}

test('les 27 mécaniques sont déclarées avec des identifiants uniques', () => {
  assert.equal(ACTIVITY_TYPES.length, 27);
  assert.equal(new Set(ACTIVITY_TYPES.map(([type]) => type)).size, 27);
});

test('seuls les quatre formats demandés sont proposés à la création', () => {
  assert.deepEqual(CREATABLE_ACTIVITY_TYPES.map(([type]) => type), ['quiz','drag-drop','true-false','scenario']);
  assert.equal(isCreatableActivityType('scenario'), true);
  assert.equal(isCreatableActivityType('word-search'), false);
});

for (const [type, label] of ACTIVITY_TYPES) {
  test(`la mécanique ${label} accepte son contenu minimal`, () => {
    assert.deepEqual(validateMechanic(type, validContent(type)), []);
  });
}

test('un quiz vide est rejeté', () => {
  assert.ok(validateMechanic('quiz', { questions: [] }).length > 0);
});

test('une mise en situation riche exige 3 à 5 scènes', () => {
  assert.deepEqual(validateScenarioContent(SCENARIO_EXAMPLE_CONTENT as unknown as Record<string,unknown>), []);
  assert.match(validateScenarioContent({ scenes: [],debrief:{} })[0] ?? '',/entre 3 et 5 scènes/);
});

test('une scène refuse un score hors barème et une destination inconnue', () => {
  const invalid = JSON.parse(JSON.stringify(SCENARIO_EXAMPLE_CONTENT)) as Record<string,unknown>;
  const scenes = invalid.scenes as Array<Record<string,unknown>>;
  const choices = scenes[0].choices as Array<Record<string,unknown>>;
  choices[0].score = 7; choices[0].nextSceneId = 'scene-absente';
  const errors = validateScenarioContent(invalid).join(' ');
  assert.match(errors,/0, 1 ou 2/);
  assert.match(errors,/introuvable/);
});

test('les réponses saisies sont normalisées sans accent ni espaces parasites', () => {
  assert.equal(normalizeAnswer('  Équipement   de Protection '), 'equipement de protection');
});

test('une activité complète est validée', () => {
  const result = validateActivityDraft({ type: 'quiz', title: 'Sécurité chimique', theme: 'Prévention', audience: 'Agents', level: 'debutant', objectives: ['Identifier les risques'], durationMinutes: 10, instructions: 'Répondez.', explanation: '', correction: '', sources: [], content: validContent('quiz') });
  assert.equal(result.valid, true);
});
