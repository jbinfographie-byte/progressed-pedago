import type { ActivityType } from './activity-types.ts';
import { normalizeExternalGameContent } from './external-games.ts';

type QuizQuestion = { question?: unknown; choices?: unknown; correctIndex?: unknown; explanation?: unknown };
type TrueFalseStatement = { text?: unknown; answer?: unknown; explanation?: unknown };
type TypedPrompt = { question?: unknown; answer?: unknown; explanation?: unknown };
type Card = { front?: unknown; back?: unknown };
type ClassifiedItem = { label?: unknown; text?: unknown; category?: unknown; explanation?: unknown };
type Target = { id?: unknown; label?: unknown; description?: unknown; definition?: unknown };
type LabelledItem = { label?: unknown; text?: unknown };

export function buildManualPedagogy(type: ActivityType, title: string, objectives: string[], content: Record<string, unknown>) {
  if (type === 'external-game') return buildExternalGamePedagogy(title,objectives,content);
  const points = extractTeachingPoints(type, content);
  const usefulPoints = points.length ? points : objectives.map((objective) => String(objective).trim()).filter(Boolean);
  const lessonPoints = usefulPoints.length ? usefulPoints : [`Identifier les éléments essentiels de « ${title} » et les appliquer dans une situation professionnelle.`];
  const explanation = `## À retenir
${lessonPoints.map((point) => `- ${point}`).join('\n')}

## Comprendre
Cette activité permet de vérifier la compréhension de « ${title} ». Avant de répondre, il faut repérer la notion principale, distinguer les informations utiles des propositions peu pertinentes et relier la réponse à une situation professionnelle concrète.

## Méthode pas à pas
- Lire entièrement la question ou la consigne avant de choisir.
- Repérer les mots importants et reformuler la règle avec ses propres mots.
- Comparer chaque proposition avec les bonnes pratiques présentées dans l’activité.
- Justifier la réponse par une conséquence concrète pour la qualité, l’organisation ou la sécurité.

## Erreurs à éviter
- Répondre trop vite sans lire toutes les propositions.
- Choisir une réponse vraisemblable mais sans lien direct avec la consigne.
- Mémoriser une réponse sans être capable d’expliquer pourquoi elle est correcte.

## Mémo
Une réponse est réellement acquise lorsqu’elle peut être expliquée simplement et appliquée dans une situation de travail.`;

  const correctionLines = buildCorrectionLines(type, content);
  const correction = `## Réponses attendues
${(correctionLines.length ? correctionLines : lessonPoints).map((line) => `- ${line}`).join('\n')}

## Critères de réussite
- La réponse choisie est exacte.
- Le participant sait justifier son choix avec la règle ou la bonne pratique correspondante.
- Il peut donner un exemple d’application dans son environnement professionnel.

## Reprise pédagogique
En cas d’erreur, faire relire la consigne, demander au participant d’expliquer son raisonnement, puis revenir au point correspondant du mini-cours avant une nouvelle tentative.`;

  return { explanation, correction };
}

function buildExternalGamePedagogy(title:string,objectives:string[],content:Record<string,unknown>) {
  const game=normalizeExternalGameContent(content);
  const explanation=[
    '## Introduction',game.introduction||`Cette activité externe permet de travailler « ${title} » de manière interactive.`,
    '## Avant de commencer',game.preGameExplanation||'Relisez les objectifs et prenez le temps d’observer chaque consigne avant de répondre.',
    '## Objectifs',...(objectives.length?objectives:['Comprendre la notion principale et savoir la mobiliser dans une situation professionnelle.']).map((item)=>`- ${item}`),
    '## Conseils',...(game.learnerTips.length?game.learnerTips:['Lisez entièrement chaque proposition.','Justifiez mentalement votre choix.','Revenez au cours en cas d’hésitation.']).map((item)=>`- ${item}`),
  ].join('\n');
  const correctionText=text(content.aiCorrection);
  const answers=game.paper.questions.filter((item)=>item.answer).map((item,index)=>`- ${index+1}. ${item.question} — ${item.answer}`);
  const correction=[
    '## Débriefing',game.debrief||'Comparez les stratégies utilisées, identifiez les erreurs récurrentes et reformulez collectivement les règles importantes.',
    answers.length?'## Réponses de la version papier':'',...answers,
    correctionText?'## Explications complémentaires':'',correctionText,
    '## Validation','Le site externe ne transmet pas nécessairement de score. La réussite est donc validée manuellement, ou à partir du score déclaré par l’apprenant lorsque cette option est activée.',
  ].filter(Boolean).join('\n');
  return {explanation,correction};
}

function extractTeachingPoints(type: ActivityType, content: Record<string, unknown>): string[] {
  if (type === 'quiz' || type === 'tv-quiz') return arrayOf<QuizQuestion>(content.questions).map((item) => {
    const explanation = text(item.explanation);
    if (explanation) return explanation;
    const choices = strings(item.choices);
    return choices[Number(item.correctIndex ?? 0)] ? `La réponse attendue à « ${text(item.question)} » est « ${choices[Number(item.correctIndex ?? 0)]} ».` : '';
  }).filter(Boolean);
  if (type === 'true-false') return arrayOf<TrueFalseStatement>(content.statements).map((item) => text(item.explanation) || `L’affirmation « ${text(item.text)} » est ${Boolean(item.answer) ? 'vraie' : 'fausse'}.`).filter(Boolean);
  if (type === 'type-answer') return arrayOf<TypedPrompt>(content.prompts).map((item) => text(item.explanation) || `La réponse attendue à « ${text(item.question)} » est « ${text(item.answer)} ».`).filter(Boolean);
  if (['flip-tiles','revision-cards','random-cards','memory-cards','pair-or-not'].includes(type)) return arrayOf<Card>(content.cards).map((item) => `${text(item.front)} : ${text(item.back)}`).filter((value) => value !== ' : ');
  if (type === 'drag-drop' || type === 'matching' || type === 'categories' || type === 'labelled-diagram') {
    const targets = arrayOf<Target>(arrayOf(content.zones).length ? content.zones : content.categories);
    return arrayOf<ClassifiedItem>(content.items).map((item) => { const target = targets.find((candidate) => [text(candidate.id),text(candidate.label)].includes(text(item.category))); return text(item.explanation) || `${text(item.label,item.text)} s’associe à ${text(target?.description,target?.definition,target?.label,item.category)}.`; }).filter(Boolean);
  }
  if (type === 'ranking') return arrayOf<LabelledItem>(content.items).map((item,index) => `Étape ${index + 1} : ${text(item.label,item.text)}.`).filter((value) => !value.endsWith(': .'));
  if (type === 'question-wheel' || type === 'challenge-wheel') return arrayOf<LabelledItem>(content.sectors).map((item) => `Question ou défi à traiter : ${text(item.label,item.text)}.`).filter((value) => !value.endsWith(': .'));
  if (type === 'live-poll') return [`Le sondage « ${text(content.question)} » permet de recueillir et comparer les représentations du groupe.`];
  return [];
}

function buildCorrectionLines(type: ActivityType, content: Record<string, unknown>): string[] {
  if (type === 'quiz' || type === 'tv-quiz') return arrayOf<QuizQuestion>(content.questions).map((item,index) => {
    const choices = strings(item.choices); const answer = choices[Number(item.correctIndex ?? 0)] ?? 'Réponse à préciser';
    return `Question ${index + 1} — ${answer}. ${text(item.explanation)}`.trim();
  });
  if (type === 'true-false') return arrayOf<TrueFalseStatement>(content.statements).map((item,index) => `Affirmation ${index + 1} — ${Boolean(item.answer) ? 'Vrai' : 'Faux'}. ${text(item.explanation)}`.trim());
  if (type === 'type-answer') return arrayOf<TypedPrompt>(content.prompts).map((item,index) => `Question ${index + 1} — ${text(item.answer)}. ${text(item.explanation)}`.trim());
  if (type === 'drag-drop' || type === 'matching' || type === 'categories' || type === 'labelled-diagram') return extractTeachingPoints(type,content);
  if (type === 'ranking') return [`Ordre attendu — ${arrayOf<LabelledItem>(content.items).map((item) => text(item.label,item.text)).filter(Boolean).join(' → ')}.`];
  return extractTeachingPoints(type, content);
}

function arrayOf<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(text) : []; }
function text(...values: unknown[]): string { const value = values.find((item) => typeof item === 'string' && item.trim()); return typeof value === 'string' ? value.trim() : ''; }
