import { validateScenarioContent } from './scenario.ts';

export const ACTIVITY_TYPES = [
  ['quiz', 'Quiz interactif', 'Questions, réponses mélangées et explications'], ['drag-drop', 'Glisser-déposer', 'Déplacer des éléments vers les bonnes zones'],
  ['true-false', 'Vrai ou faux', 'Décider et comprendre la correction'], ['word-search', 'Mots mêlés', 'Retrouver les mots cachés dans une grille'],
  ['hangman', 'Pendu', 'Découvrir un mot lettre après lettre'], ['spell-word', 'Épeler le mot', 'Remettre les lettres dans le bon ordre'],
  ['crossword', 'Mots croisés', 'Compléter une grille à partir de définitions'], ['flip-tiles', 'Retournez les tuiles', 'Explorer des cartes recto-verso'],
  ['type-answer', 'Tapez la réponse', 'Saisir une réponse normalisée'], ['ranking', 'Classement par rang', 'Remettre les étapes dans le bon ordre'],
  ['revision-cards', 'Fiches de révision', 'Question, réponse et auto-évaluation'], ['matching', 'Apparier', 'Associer les notions et leurs définitions'],
  ['labelled-diagram', 'Diagramme étiqueté', 'Placer des étiquettes sur une image'], ['tv-quiz', 'Quiz télévisé', 'Chronomètre, vies, bonus et progression'],
  ['random-cards', 'Cartes aléatoires', 'Tirer une carte au hasard'], ['maze', 'Poursuite dans le labyrinthe', 'Se déplacer vers la bonne réponse'],
  ['pair-or-not', 'Paire ou pas de paire', 'Comparer deux cartes'], ['unravel', 'Démêler', 'Reconstruire une phrase dans le bon ordre'],
  ['anagram', 'Anagramme', 'Remettre les lettres dans le bon ordre'], ['flying-fruits', 'Fruits volants', 'Sélectionner rapidement une réponse mobile'],
  ['interactive-image', 'Image interactive', 'Explorer les zones d’une image'], ['scenario', 'Mise en situation', 'Choisir et observer les conséquences'],
  ['memory-cards', 'Cartes mémoire', 'Mémoriser et marquer acquis ou à revoir'], ['live-poll', 'Sondage en direct', 'Collecter et afficher des réponses'],
  ['challenge-wheel', 'Roue du défi', 'Faire tourner une roue de missions'], ['question-wheel', 'Roue de questions', 'Faire tourner une roue de questions'],
  ['categories', 'Classement par catégories', 'Répartir des éléments par catégorie'],
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number][0];
export const CREATABLE_ACTIVITY_TYPE_IDS = ['quiz','drag-drop','true-false','scenario'] as const satisfies readonly ActivityType[];
const creatableActivityTypeIds = new Set<string>(CREATABLE_ACTIVITY_TYPE_IDS);
export const CREATABLE_ACTIVITY_TYPES = ACTIVITY_TYPES.filter(([type]) => creatableActivityTypeIds.has(type));
export type CreatableActivityType = (typeof CREATABLE_ACTIVITY_TYPE_IDS)[number];
export function isCreatableActivityType(value: unknown): value is CreatableActivityType { return typeof value === 'string' && creatableActivityTypeIds.has(value); }
export const MANUAL_ACTIVITY_TYPE_IDS = ['quiz','drag-drop','true-false','scenario','matching','ranking','revision-cards','type-answer','question-wheel','live-poll'] as const satisfies readonly ActivityType[];
const manualActivityTypeIds = new Set<string>(MANUAL_ACTIVITY_TYPE_IDS);
export const MANUAL_ACTIVITY_TYPES = MANUAL_ACTIVITY_TYPE_IDS.map((type) => ACTIVITY_TYPES.find(([candidate]) => candidate === type)!);
export type ManualActivityType = (typeof MANUAL_ACTIVITY_TYPE_IDS)[number];
export function isManualActivityType(value: unknown): value is ManualActivityType { return typeof value === 'string' && manualActivityTypeIds.has(value); }
export type ActivityDraft = { type: ActivityType; title: string; theme: string; audience: string; level: 'debutant' | 'intermediaire' | 'avance'; objectives: string[]; durationMinutes: number; instructions: string; explanation: string; correction: string; sources: Array<{ title: string; organization?: string; url: string; usedFor?: string }>; content: Record<string, unknown> };

const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function normalizeAnswer(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr'); }

export function validateActivityDraft(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return { valid: false, errors: ['Le contenu généré est vide.'] };
  const draft = value as Partial<ActivityDraft>;
  if (!ACTIVITY_TYPES.some(([type]) => type === draft.type)) errors.push('Le format d’activité est inconnu.');
  if (text(draft.title).length < 3) errors.push('Le titre doit contenir au moins 3 caractères.');
  if (!text(draft.theme)) errors.push('Le thème est obligatoire.');
  if (!Number.isInteger(draft.durationMinutes) || Number(draft.durationMinutes) < 1 || Number(draft.durationMinutes) > 480) errors.push('La durée doit être comprise entre 1 et 480 minutes.');
  if (list(draft.objectives).filter((item) => text(item)).length === 0) errors.push('Au moins un objectif pédagogique est obligatoire.');
  if (!draft.content || typeof draft.content !== 'object') errors.push('La mécanique de l’activité est absente.'); else errors.push(...validateMechanic(draft.type as ActivityType, draft.content));
  return { valid: errors.length === 0, errors };
}

export function validateMechanic(type: ActivityType, content: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const requireItems = (key: string, minimum = 1) => { if (list(content[key]).length < minimum) errors.push(`La mécanique « ${type} » nécessite ${minimum} élément(s) dans ${key}.`); };
  switch (type) {
    case 'quiz': case 'tv-quiz': requireItems('questions'); break; case 'true-false': requireItems('statements'); break;
    case 'word-search': requireItems('grid'); requireItems('words'); break; case 'crossword': requireItems('grid'); requireItems('clues'); break; case 'hangman': requireItems('words'); break;
    case 'flip-tiles': case 'revision-cards': case 'random-cards': case 'memory-cards': case 'pair-or-not': requireItems('cards'); break;
    case 'type-answer': requireItems('prompts'); break; case 'interactive-image': if (!text(content.imageUrl)) errors.push('Une image est obligatoire.'); requireItems('hotspots'); break;
    case 'scenario': if (Array.isArray(content.scenes)) errors.push(...validateScenarioContent(content)); else requireItems('steps'); break; case 'live-poll': if (!text(content.question)) errors.push('La question du sondage est obligatoire.'); requireItems('options', 2); break;
    case 'challenge-wheel': case 'question-wheel': requireItems('sectors', 2); break; case 'drag-drop': requireItems('items', 2); if (list(content.zones).length < 2 && list(content.categories).length < 2) errors.push('La mécanique « drag-drop » nécessite au moins 2 zones ou catégories.'); break; case 'categories': requireItems('categories', 2); requireItems('items', 2); break;
    case 'maze': requireItems('cells', 4); break; case 'flying-fruits': requireItems('prompts'); break; default: requireItems('items', 2);
  }
  return errors;
}

export function activityJsonSchema() { return { type: 'object', additionalProperties: false, required: ['type', 'title', 'theme', 'audience', 'level', 'objectives', 'durationMinutes', 'instructions', 'explanation', 'correction', 'sources', 'content'], properties: { type: { type: 'string', enum: ACTIVITY_TYPES.map(([type]) => type) }, title: { type: 'string', minLength: 3 }, theme: { type: 'string' }, audience: { type: 'string' }, level: { type: 'string', enum: ['debutant', 'intermediaire', 'avance'] }, objectives: { type: 'array', minItems: 1, items: { type: 'string' } }, durationMinutes: { type: 'integer', minimum: 1, maximum: 480 }, instructions: { type: 'string' }, explanation: { type: 'string' }, correction: { type: 'string' }, sources: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, organization: { type: 'string' }, url: { type: 'string' }, usedFor: { type: 'string' } } } }, content: { type: 'object', additionalProperties: true } } }; }
