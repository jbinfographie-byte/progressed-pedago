import type { ActivityDraft, ActivityType } from './activity-types.ts';

export type ExplanationDepth = 'none' | 'essential' | 'detailed';

export function normalizeExplanationDepth(value: unknown): ExplanationDepth {
  return value === 'none' || value === 'essential' ? value : 'detailed';
}

export function buildGenerationPrompt(prompt: string, formats: ActivityType[], body: Record<string, unknown>): string {
  const depth = normalizeExplanationDepth(body.explanationDepth);
  const lessonInstruction = depth === 'none'
    ? 'Le champ explanation peut rester vide. Fournis néanmoins une correction brève et exacte pour chaque réponse.'
    : depth === 'essential'
      ? 'Le champ explanation doit présenter les notions clés en 4 à 6 paragraphes courts. Structure-le avec des titres commençant par ## et termine par un mémo. Chaque réponse doit avoir une correction de 2 à 3 phrases.'
      : 'Le champ explanation doit constituer un mini-cours autonome et détaillé de 700 à 1 400 mots : ## À retenir, ## Comprendre, ## Méthode pas à pas, ## Exemple professionnel, ## Erreurs à éviter et ## Mémo. Utilise aussi des listes commençant par -. Chaque correction de quiz, vrai-faux ou réponse saisie doit contenir 4 à 6 phrases : justification de la bonne réponse, raison pour laquelle l’erreur est plausible, exemple concret, conséquence professionnelle et astuce de mémorisation.';
  const scenarioInstruction = formats.includes('scenario') ? `
Exigences obligatoires pour la mise en situation :
- Crée exactement ${Math.min(5,Math.max(3,Number(body.scenarioCount) || 4))} scènes de difficulté ${String(body.scenarioDifficulty ?? 'progressive')} pour le métier ou secteur « ${String(body.scenarioProfession ?? body.audience ?? 'formation professionnelle')} ».
- Contraintes à intégrer : ${String(body.scenarioConstraints ?? 'contraintes réalistes du terrain, sécurité, communication et organisation')}.
- La progression doit former une histoire cohérente : préparation, événement ou problème, adaptation et clôture. Une scène s’affiche à la fois.
- content doit contenir version:2, progressive:${body.scenarioProgressive !== false}, simplifiedFrench:${body.scenarioSimpleFrench !== false}, scenes et debrief.
- Chaque scène contient obligatoirement : id unique, title, location, moment, learnerRole, people, context, problem, constraints, dialogue facultatif, mission, objective, competencies, observationCriteria, usefulInformation, documents, question et 3 ou 4 choices.
- Chaque choix contient : id unique, text, score (0, 1 ou 2), consequence, positivePoints, risks, recommendedConduct, explanation, nextSceneId et source facultative. Prévois au moins une décision recommandée notée 2, une décision partielle notée 1 et une décision à risque notée 0. Les réponses doivent toutes sembler plausibles et leur ordre ne doit pas être prévisible.
- nextSceneId pointe vers l’id de la scène suivante ; utilise null à la dernière scène. Ne crée pas de boucle.
- debrief contient title, summary, bestPractices, pointsToReview et trainerQuestions. Les explications doivent être concrètes, professionnelles, bienveillantes et exploitables en correction collective.${body.scenarioSimpleFrench ? '\n- Emploie des phrases courtes et un français simple sans supprimer le vocabulaire professionnel utile.' : ''}
` : '';
  return `Demande du formateur : ${prompt}
Public : ${String(body.audience ?? 'adultes en formation professionnelle')}
Niveau : ${String(body.level ?? 'débutant')}
Durée : ${String(body.durationMinutes ?? 20)} minutes
Formats obligatoires : ${formats.join(', ')}.

Exigences pour le cours et les explications :
${lessonInstruction}
- Si des fichiers sont joints, reprends fidèlement leurs notions, procédures, exemples et vocabulaire dans le mini-cours et les corrections. Ne mentionne pas une information absente ou incertaine.
- Le champ correction doit fournir une synthèse exploitable par le formateur : réponses attendues, critères de réussite, points de vigilance et pistes de reformulation.
- Les objectifs, le mini-cours, l’exercice et la correction doivent traiter exactement le même contenu.
${scenarioInstruction}

Exigences pour les mécaniques :
- quiz et tv-quiz : 5 à 10 questions dans questions, 3 ou 4 choices plausibles, correctIndex varié, explanation détaillée pour chaque question ;
- true-false : 6 à 10 statements avec answer et explanation ;
- drag-drop, matching, categories et labelled-diagram : items munis de label et category, et categories ou zones clairement nommées ;
- word-search : grid rectangulaire lisible et words réellement présents dans la grille ; crossword : grid et clues cohérents ; hangman : words pertinents ;
- flip-tiles, revision-cards, random-cards, memory-cards et pair-or-not : cards avec front, back et pair lorsque nécessaire ;
- spell-word, ranking, unravel et anagram : items ordonnables, et word ou sentence si utile ;
- type-answer : prompts avec question, answer et explanation ;
- challenge-wheel et question-wheel : sectors contenant au moins 6 missions ou questions concrètes ;
- maze : cells avec label et correct ; scenario : utilise exclusivement la structure riche scenes/debrief décrite ci-dessus, jamais l’ancien format steps ;
- live-poll : question et options ; interactive-image : imageUrl et hotspots avec label et answer ; flying-fruits : prompts avec question et options label/correct.

Place la mécanique sous forme de chaîne JSON strictement valide dans contentJson. Mélange la position des bonnes réponses. Les sources doivent provenir uniquement de la recherche web ou des documents joints.`;
}

export function validateGeneratedExplanation(draft: ActivityDraft, depthValue: unknown): string | null {
  const depth = normalizeExplanationDepth(depthValue);
  if (depth === 'none') return null;
  const minimum = depth === 'detailed' ? 600 : 180;
  if (draft.explanation.trim().length < minimum) return `le mini-cours de « ${draft.title} » est trop court pour le niveau d’explication demandé.`;
  if (draft.type === 'quiz' || draft.type === 'tv-quiz') {
    const questions = Array.isArray(draft.content.questions) ? draft.content.questions as Array<{ explanation?: unknown }> : [];
    const perQuestionMinimum = depth === 'detailed' ? 180 : 70;
    if (questions.some((question) => String(question.explanation ?? '').trim().length < perQuestionMinimum)) return `une ou plusieurs corrections du quiz « ${draft.title} » manquent de détails.`;
  }
  return null;
}
