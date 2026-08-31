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

test('la génération de mise en situation exige des scènes progressives complètes', () => {
  const prompt = buildGenerationPrompt('Créer une mise en situation en EHPAD',['scenario'],{scenarioCount:4,scenarioProfession:'Agent de bio-nettoyage',scenarioDifficulty:'progressive',scenarioSimpleFrench:true});
  assert.match(prompt,/exactement 4 scènes/);
  assert.match(prompt,/consequence, positivePoints, risks, recommendedConduct, explanation/);
  assert.match(prompt,/jamais l’ancien format steps/);
  assert.match(prompt,/français simple/);
});

test('le cours PDF exige un nombre exact de pages et couvre toutes les pages sources',()=>{
  const prompt=buildGenerationPrompt('Transformer tout le PDF en cours',['quiz'],{multiPageCourse:true,coursePageCount:12,courseLength:'complete'});
  assert.match(prompt,/une seule propriété coursePages/);
  assert.match(prompt,/exactement 12 pages/);
  assert.match(prompt,/Chaque marqueur \[document:IDENTIFIANT\|page:NUMERO\]/);
  assert.match(prompt,/Ne produis jamais un simple résumé/);
  assert.match(prompt,/chaque leçon à partir de l’introduction se termine obligatoirement par un exercice/);
  assert.match(prompt,/quiz.*,.*true-false.*,.*scenario.*,.*reflection/);
});
