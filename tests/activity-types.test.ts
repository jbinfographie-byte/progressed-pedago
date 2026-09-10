import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_TYPES, CREATABLE_ACTIVITY_TYPES, MANUAL_ACTIVITY_TYPES, isCreatableActivityType, isManualActivityType, normalizeAnswer, validateActivityDraft, validateMechanic, type ActivityType } from '../lib/activity-types.ts';
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
  if (type === 'drag-drop') return { mode:'association',categories:[{ id:'a',label:'A' },{ id:'b',label:'B' }],items:[{ label:'1',category:'a' },{ label:'2',category:'b' }] };
  if (type === 'external-game') return { embedUrl:'https://wordwall.net/fr/embed/example',paper:{learnerVersion:true,trainerVersion:false} };
  if (type === 'voice-coach') return { learningLanguage:'anglais',cefrLevel:'A1',topic:'Se présenter' };
  return { items: [{ label: 'A' },{ label: 'B' }] };
}

test('les 29 mécaniques sont déclarées avec des identifiants uniques', () => {
  assert.equal(ACTIVITY_TYPES.length, 29);
  assert.equal(new Set(ACTIVITY_TYPES.map(([type]) => type)).size, 29);
});

test('seuls les quatre formats demandés sont proposés à la création', () => {
  assert.deepEqual(CREATABLE_ACTIVITY_TYPES.map(([type]) => type), ['quiz','drag-drop','true-false','scenario']);
  assert.equal(isCreatableActivityType('scenario'), true);
  assert.equal(isCreatableActivityType('word-search'), false);
});

test('l’atelier manuel propose douze formats guidés sans charger le tableau de bord', () => {
  assert.deepEqual(MANUAL_ACTIVITY_TYPES.map(([type]) => type), ['quiz','drag-drop','true-false','scenario','matching','ranking','revision-cards','type-answer','question-wheel','live-poll','external-game','voice-coach']);
  assert.equal(isManualActivityType('matching'),true);
  assert.equal(isManualActivityType('word-search'),false);
});

for (const [type, label] of ACTIVITY_TYPES) {
  test(`la mécanique ${label} accepte son contenu minimal`, () => {
    assert.deepEqual(validateMechanic(type, validContent(type)), []);
  });
}

test('un quiz vide est rejeté', () => {
  assert.ok(validateMechanic('quiz', { questions: [] }).length > 0);
});

test('un parcours progressif riche exige 3 à 6 scènes', () => {
  assert.deepEqual(validateScenarioContent(SCENARIO_EXAMPLE_CONTENT as unknown as Record<string,unknown>), []);
  assert.match(validateScenarioContent({ mode:'progressive',scenes: [],debrief:{} })[0] ?? '',/entre 3 et 6 scènes/);
});

test('une mise en situation autonome peut contenir une seule scène', () => {
  const single = JSON.parse(JSON.stringify(SCENARIO_EXAMPLE_CONTENT)) as Record<string,unknown>;
  single.mode = 'single'; single.scenes = (single.scenes as unknown[]).slice(0,1);
  for (const choice of ((single.scenes as Array<Record<string,unknown>>)[0].choices as Array<Record<string,unknown>>)) choice.nextSceneId = null;
  assert.deepEqual(validateScenarioContent(single),[]);
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
