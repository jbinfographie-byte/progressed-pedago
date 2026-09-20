type UnknownRecord = Record<string, unknown>;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function relocateCorrectChoice(value: unknown, targetIndex: number): unknown {
  if (!isRecord(value) || !Array.isArray(value.choices)) return value;
  const choices = [...value.choices];
  const correctIndex = Number(value.correctIndex);
  if (choices.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) return value;

  const [correctChoice] = choices.splice(correctIndex, 1);
  const resolvedTarget = Math.min(Math.max(0, targetIndex), choices.length);
  choices.splice(resolvedTarget, 0, correctChoice);
  return { ...value, choices, correctIndex: resolvedTarget };
}

/**
 * Répartit une fois les bonnes réponses avant l'enregistrement.
 *
 * Le point de départ dépend de la génération, puis les positions tournent entre
 * tous les choix disponibles. Une série de quiz à quatre choix utilise ainsi
 * A, B, C et D au lieu de conserver le biais de position éventuellement renvoyé
 * par le modèle. Le contenu de la bonne réponse n'est jamais modifié.
 */
export function diversifyGeneratedAnswerPositions(content: UnknownRecord, seed: string): UnknownRecord {
  const offset = stableHash(seed);
  let diversified = content;

  if (Array.isArray(content.questions)) {
    diversified = {
      ...diversified,
      questions: content.questions.map((question, index) => {
        const choiceCount = isRecord(question) && Array.isArray(question.choices) ? question.choices.length : 0;
        return relocateCorrectChoice(question, choiceCount ? (offset + index) % choiceCount : 0);
      }),
    };
  }

  if (Array.isArray(content.items) && content.items.some((item) => isRecord(item) && typeof item.spokenText === 'string' && Array.isArray(item.choices))) {
    diversified = {
      ...diversified,
      items: content.items.map((item, index) => {
        const choiceCount = isRecord(item) && Array.isArray(item.choices) ? item.choices.length : 0;
        return relocateCorrectChoice(item, choiceCount ? (offset + index) % choiceCount : 0);
      }),
    };
  }

  if (Array.isArray(content.coursePages)) {
    diversified = {
      ...diversified,
      coursePages: content.coursePages.map((page, index) => {
        if (!isRecord(page) || !isRecord(page.practice) || !Array.isArray(page.practice.choices)) return page;
        const choiceCount = page.practice.choices.length;
        if (!choiceCount) return page;
        return {
          ...page,
          practice: relocateCorrectChoice(page.practice, (offset + index) % choiceCount),
        };
      }),
    };
  }

  return diversified;
}
