import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActivityDraft } from '../lib/activity-types.ts';
import { buildGenerationPrompt, normalizeExplanationDepth, validateGeneratedExplanation } from '../lib/generation-guidance.ts';

const detailedQuiz: ActivityDraft = {
  type: 'quiz',
  title: 'Prévention des risques chimiques',
  theme: 'Sécurité',
  audience: 'Agents de propreté',
  level: 'debutant',
  objectives: ['Identifier les risques'],
  durationMinutes: 20,
  instructions: 'Répondez puis justifiez.',
  explanation: '## À retenir\n' + 'Explication professionnelle détaillée. '.repeat(30),
  correction: 'Correction complète.',
  sources: [],
  content: { questions: [{ question:'Que faut-il consulter ?', choices:['La FDS','La météo','Le planning'], correctIndex:0, explanation:'La fiche de données de sécurité décrit les dangers et les protections. Une confusion est possible lorsque l’étiquette paraît familière, mais elle ne remplace pas la fiche. En situation professionnelle, cette consultation précède la préparation du produit. Elle évite une exposition ou un mélange dangereux. Astuce : FDS signifie fiche, dangers, sécurité.'.repeat(2) }] },
};

test('le niveau détaillé demande un mini-cours structuré et exploite les fichiers', () => {
  const prompt = buildGenerationPrompt('Créer une activité sur les risques chimiques', ['quiz'], { explanationDepth:'detailed', audience:'agents' });
  assert.match(prompt,/## Méthode pas à pas/);
  assert.match(prompt,/fichiers sont joints/);
  assert.match(prompt,/4 à 6 phrases/);
});

test('le contrôle accepte un quiz réellement détaillé', () => {
  assert.equal(validateGeneratedExplanation(detailedQuiz,'detailed'), null);
});

test('le contrôle refuse une explication détaillée trop courte', () => {
  assert.match(validateGeneratedExplanation({ ...detailedQuiz, explanation:'Trop court.' },'detailed') ?? '',/trop court/);
});

test('une valeur inconnue revient au niveau détaillé', () => {
  assert.equal(normalizeExplanationDepth('inconnu'), 'detailed');
});
