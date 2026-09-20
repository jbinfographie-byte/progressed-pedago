export type AudioQuizItem = {
  id: string;
  spokenText: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

export type AudioQuizContent = {
  language: string;
  speechRate: number;
  repeatAllowed: boolean;
  items: AudioQuizItem[];
  sourceDocuments: Array<{ id: string; name: string }>;
};

const records = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
  : [];

const clean = (value: unknown, max = 600) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function normalizeAudioQuizContent(value: unknown): AudioQuizContent {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const items = records(input.items).slice(0, 40).map((item, index) => {
    const choices = Array.isArray(item.choices) ? item.choices.map((choice) => clean(choice, 300)).filter(Boolean).slice(0, 4) : [];
    const rawIndex = Math.floor(Number(item.correctIndex));
    const correctIndex = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < choices.length ? rawIndex : 0;
    return {
      id: clean(item.id, 100) || `audio-item-${index + 1}`,
      spokenText: clean(item.spokenText ?? item.audioText ?? item.text, 600),
      question: clean(item.question, 300) || 'Quel mot ou quelle phrase avez-vous entendu ?',
      choices,
      correctIndex,
      explanation: clean(item.explanation, 1_200),
    };
  });
  const rate = Number(input.speechRate);
  return {
    language: clean(input.language, 40) || 'fr-FR',
    speechRate: Number.isFinite(rate) ? Math.min(1.3, Math.max(0.6, rate)) : 0.9,
    repeatAllowed: input.repeatAllowed !== false,
    items,
    sourceDocuments: records(input.sourceDocuments).map((document) => ({ id:clean(document.id,100),name:clean(document.name,240) })).filter((document) => document.id && document.name),
  };
}

export function audioQuizValidationErrors(value: unknown): string[] {
  const quiz = normalizeAudioQuizContent(value);
  const errors: string[] = [];
  if (quiz.items.length < 2) errors.push('Le quiz audio nécessite au moins 2 mots ou phrases.');
  quiz.items.forEach((item, index) => {
    if (!item.spokenText) errors.push(`L’élément audio ${index + 1} ne contient aucun texte à prononcer.`);
    if (item.choices.length < 2) errors.push(`L’élément audio ${index + 1} nécessite au moins 2 réponses.`);
    if (!item.choices[item.correctIndex]) errors.push(`La bonne réponse de l’élément audio ${index + 1} est invalide.`);
  });
  return errors;
}

export function audioQuizFromLines(text: string, language = 'fr-FR'): AudioQuizContent {
  const lines = [...new Set(text.split(/\r?\n/).map((line) => clean(line, 300)).filter(Boolean))].slice(0, 30);
  const items = lines.map((spokenText, index) => {
    const pool = [spokenText, ...lines.filter((line) => line !== spokenText)].slice(0, Math.min(4, lines.length));
    const shift = pool.length ? index % pool.length : 0;
    const choices = pool.length ? [...pool.slice(shift), ...pool.slice(0, shift)] : [];
    return {
      id: `audio-item-${index + 1}`,
      spokenText,
      question: 'Quel mot ou quelle phrase avez-vous entendu ?',
      choices,
      correctIndex: Math.max(0, choices.indexOf(spokenText)),
      explanation: `La réponse prononcée était « ${spokenText} ».`,
    };
  });
  return { language, speechRate:0.9, repeatAllowed:true, items, sourceDocuments:[] };
}
