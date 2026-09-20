import type { ActivityDraft, ActivityType } from './activity-types.ts';

export type ExplanationDepth = 'none' | 'essential' | 'detailed';

export function normalizeExplanationDepth(value: unknown): ExplanationDepth {
  return value === 'none' || value === 'essential' ? value : 'detailed';
}

export function buildGenerationPrompt(prompt: string, formats: ActivityType[], body: Record<string, unknown>): string {
  const depth = normalizeExplanationDepth(body.explanationDepth);
  const pageCount = Math.min(24,Math.max(4,Number(body.coursePageCount) || 7));
  const multiPageCourse = body.multiPageCourse === true;
  const externalOutputs = Array.isArray(body.externalOutputs) ? body.externalOutputs.map(String) : [];
  const externalInstruction = body.sourceKind === 'external' ? `
Exigences pour la ressource externe analysée :
- L’analyse validée par le formateur est la référence principale. Les contenus demandés sont : ${externalOutputs.join(', ') || 'cours, résumé, explications, quiz, corrigé et PDF'}.
- Les questions, exemples, mises en situation et corrections doivent découler directement des notions réellement identifiées. Ne te contente jamais de reprendre le titre de la ressource.
- Ne prétends pas connaître un écran, une question, une réponse ou un score qui n’apparaît pas dans la source ou les éléments fournis.
- L’activité externe elle-même est enregistrée séparément par l’application : génère ici uniquement les activités complémentaires demandées.
` : '';
  const lessonInstruction = depth === 'none'
    ? 'Le champ explanation peut rester vide. Fournis néanmoins une correction brève et exacte pour chaque réponse.'
    : depth === 'essential'
      ? 'Le champ explanation doit présenter les notions clés en 4 à 6 paragraphes courts. Structure-le avec des titres commençant par ## et termine par un mémo. Chaque réponse doit avoir une correction de 2 à 3 phrases.'
      : 'Le champ explanation doit constituer un mini-cours autonome et détaillé de 700 à 1 400 mots : ## À retenir, ## Comprendre, ## Méthode pas à pas, ## Exemple professionnel, ## Erreurs à éviter et ## Mémo. Utilise aussi des listes commençant par -. Chaque correction de quiz, vrai-faux ou réponse saisie doit contenir 4 à 6 phrases : justification de la bonne réponse, raison pour laquelle l’erreur est plausible, exemple concret, conséquence professionnelle et astuce de mémorisation.';
  const scenarioInstruction = formats.includes('scenario') ? `
Exigences obligatoires pour la mise en situation :
- Mode demandé : ${String(body.scenarioMode ?? 'progressive')}. Crée exactement ${Math.min(6,Math.max(1,Number(body.scenarioCount) || 4))} scènes comportant ${Math.min(3,Math.max(1,Number(body.scenarioStepCount) || 1))} étape(s) décisionnelle(s), de difficulté ${String(body.scenarioDifficulty ?? 'progressive')}, pour le métier ou secteur « ${String(body.scenarioProfession ?? body.audience ?? 'formation professionnelle')} ».
- Contraintes à intégrer : ${String(body.scenarioConstraints ?? 'contraintes réalistes du terrain, sécurité, communication et organisation')}.
- Pour un mode progressive ou successive, la progression doit former une histoire cohérente : préparation, événement ou problème, adaptation et clôture. En mode independent, chaque scène doit rester compréhensible isolément. Une scène s’affiche à la fois.
- content doit contenir version:2, mode:"${String(body.scenarioMode ?? 'progressive')}", progressive:${body.scenarioProgressive !== false}, simplifiedFrench:${body.scenarioSimpleFrench !== false}, feedbackTiming:"${String(body.scenarioFeedbackTiming ?? 'immediate')}", scoreMode:"${String(body.scenarioScoreMode ?? 'points')}", showHints:${body.scenarioShowHints === true}, addImages:${body.scenarioAddImages === true}, outputs:${JSON.stringify(Array.isArray(body.scenarioOutputs) ? body.scenarioOutputs : ['digital','a4','learner','trainer'])}, scenes et debrief.
- Chaque scène contient obligatoirement : id unique, title, location, moment, learnerRole, people, context, problem, constraints, dialogue facultatif, mission, objective, competencies, observationCriteria, usefulInformation, documents, question, sources et exactement ${Math.min(4,Math.max(3,Number(body.scenarioChoiceCount) || 3))} choices.
- Si une BASE DOCUMENTAIRE PRIVÉE est fournie, sources contient au moins une citation exacte {documentId, pageNumber, passage} issue des marqueurs [document:...|page:...]. N’utilise jamais un identifiant ou une page absente. Cite la page qui justifie réellement la scène. Sans base documentaire, sources peut rester vide.
- Chaque choix contient : id unique, text, score (0, 1 ou 2), consequence, positivePoints, risks, recommendedConduct, explanation, nextSceneId, source facultative et sources facultatif. Prévois au moins une décision recommandée notée 2, une décision partielle notée 1 et une décision à risque notée 0. Les réponses doivent toutes sembler plausibles et leur ordre ne doit pas être prévisible.
- nextSceneId pointe vers l’id de la scène suivante ; utilise null à la dernière scène. Ne crée pas de boucle.
- debrief contient title, summary, bestPractices, pointsToReview et trainerQuestions. Les explications doivent être concrètes, professionnelles, bienveillantes et exploitables en correction collective.${body.scenarioSimpleFrench ? '\n- Emploie des phrases courtes et un français simple sans supprimer le vocabulaire professionnel utile.' : ''}
` : '';
  const multiPageInstruction = multiPageCourse ? `
Exigences obligatoires pour le cours PDF multipage :
- Analyse l'intégralité des pages exploitables de la BASE DOCUMENTAIRE PRIVÉE avant de rédiger. Ne produis jamais un simple résumé d'une page.
- Ajoute une seule propriété coursePages à la racine de la réponse, à côté de activities, contenant exactement ${pageCount} pages. Ce cours commun accompagne toutes les activités demandées sans être répété. L'ordre est pédagogique et l'id de chaque page est unique.
- Page 1 : kind "cover" avec titre et promesse pédagogique. Page 2 : kind "introduction" avec contexte, objectifs et prérequis. Dernière page : kind "synthesis" avec bilan, points à retenir et mise en pratique. Les pages intermédiaires sont des "chapter" structurés et, si pertinent, une page "exercises".
- Chaque page contient title, kind, lead, sections[{heading,body}], definitions[{term,definition}], examples[{title,description}], keyPoints[], practice{type,title,instructions,question,choices,correctIndex,answer,explanation} et sourceRefs[{documentId,pageNumber}]. Utilise des tableaux décrits clairement dans les sections lorsque cela facilite la compréhension.
- La couverture peut avoir une practice vide. En revanche, chaque leçon à partir de l’introduction se termine obligatoirement par un exercice directement lié à ce qui vient d’être expliqué. Alterne entre type "quiz", "true-false", "scenario" et "reflection". Pour quiz et true-false, fournis 2 à 4 choix plausibles et correctIndex. Pour scenario et reflection, choices peut rester vide. Dans tous les cas, answer donne la réponse attendue et explanation explique le raisonnement, le lien avec la leçon et un point de vigilance professionnel.
- Chaque chapitre apporte des explications développées, des définitions utiles, un exemple professionnel concret, des points clés et une application contextualisée. Le niveau de détail demandé est « ${String(body.courseLength ?? 'intermediate')} ».
- Répartis la matière sur les ${pageCount} pages sans répétition artificielle. Les exercices et le quiz doivent découler des chapitres et non être ajoutés hors contexte.
- Chaque marqueur [document:IDENTIFIANT|page:NUMERO] de la BASE DOCUMENTAIRE PRIVÉE doit apparaître au moins une fois dans les sourceRefs du cours. N'invente aucun identifiant ni numéro de page. Plusieurs références peuvent être regroupées sur une même page de cours.
- Le champ explanation reste un aperçu introductif ; coursePages constitue le cours complet destiné à l'affichage, à la bibliothèque et au PDF A4.
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
${multiPageInstruction}
${scenarioInstruction}
${externalInstruction}

Exigences pour les mécaniques :
- quiz et tv-quiz : 5 à 10 questions dans questions, exactement 4 choices plausibles, correctIndex varié, explanation détaillée pour chaque question. Répartis équitablement les bonnes réponses entre les positions A, B, C et D : ne mets jamais toutes les bonnes réponses à la même position ;
- audio-quiz : content contient language au format BCP 47 (par exemple "fr-FR" ou "en-US"), speechRate entre 0.6 et 1.3, repeatAllowed:true et 5 à 15 items. Chaque item contient id, spokenText (mot, expression ou phrase réellement issu de la source), question, exactement 4 choices plausibles, correctIndex varié et explanation. Le texte prononcé ne doit pas être affiché dans la question. Répartis équitablement les bonnes réponses entre A, B, C et D ;
- true-false : 6 à 10 statements avec answer et explanation ;
- drag-drop : crée un jeu réellement jouable selon l’un de ces deux modèles. Modèle association : content contient mode:"association", une liste items[{id,label,category,explanation}] et autant de categories[{id,label,description}] ; category référence exactement l’id de la bonne définition. Modèle visuel : content contient mode:"visual", items[{id,label,category,explanation}] et zones[{id,label,description,imageUrl facultatif,x facultatif,y facultatif}] ; category référence exactement l’id du bon visuel. Utilise des étiquettes courtes, des définitions ou visuels sans ambiguïté, 4 à 8 associations et une explication pédagogique par réponse. Si une image de fond fiable est disponible, place son URL HTTPS dans imageUrl et donne aux zones des coordonnées x/y en pourcentage ; sinon, fournis une imageUrl HTTPS par zone ou utilise le modèle association. N’invente jamais une URL d’image ;
- matching, categories et labelled-diagram : items munis de label et category, et categories ou zones clairement nommées ;
- word-search : grid rectangulaire lisible et words réellement présents dans la grille ; crossword : grid et clues cohérents ; hangman : words pertinents ;
- flip-tiles, revision-cards, random-cards, memory-cards et pair-or-not : cards avec front, back et pair lorsque nécessaire ;
- spell-word, ranking, unravel et anagram : items ordonnables, et word ou sentence si utile ;
- type-answer : prompts avec question, answer et explanation ;
- challenge-wheel et question-wheel : sectors contenant au moins 6 missions ou questions concrètes ;
- maze : cells avec label et correct ; scenario : utilise exclusivement la structure riche scenes/debrief décrite ci-dessus, jamais l’ancien format steps ;
- live-poll : question et options ; interactive-image : imageUrl et hotspots avec label et answer ; flying-fruits : prompts avec question et options label/correct.

Place la mécanique sous forme de chaîne JSON strictement valide dans contentJson. Mélange réellement la position des bonnes réponses et vérifie que les quiz utilisent plusieurs positions parmi A, B, C et D. Les sources doivent provenir uniquement de la recherche web ou des documents joints.`;
}

export function validateGeneratedExplanation(draft: ActivityDraft, depthValue: unknown): string | null {
  const depth = normalizeExplanationDepth(depthValue);
  if (depth === 'none') return null;
  const minimum = depth === 'detailed' ? 600 : 180;
  if (draft.explanation.trim().length < minimum) return `le mini-cours de « ${draft.title} » est trop court pour le niveau d’explication demandé.`;
  if (draft.type === 'quiz' || draft.type === 'tv-quiz' || draft.type === 'audio-quiz') {
    const questions = Array.isArray(draft.type === 'audio-quiz' ? draft.content.items : draft.content.questions) ? (draft.type === 'audio-quiz' ? draft.content.items : draft.content.questions) as Array<{ explanation?: unknown }> : [];
    const perQuestionMinimum = depth === 'detailed' ? 180 : 70;
    if (questions.some((question) => String(question.explanation ?? '').trim().length < perQuestionMinimum)) return `une ou plusieurs corrections du quiz « ${draft.title} » manquent de détails.`;
  }
  return null;
}
