import type { ActivityType } from './activity-types.ts';
import { normalizeDragDropContent } from './drag-drop.ts';
import { normalizeScenarioContent } from './scenario.ts';

export type CorrectionItem = {
  prompt: string;
  learnerAnswer: string;
  expectedAnswer: string;
  correct: boolean | null;
  explanation: string;
};

export type ResultCorrection = {
  kind: 'graded' | 'report' | 'manual';
  summary: string;
  items: CorrectionItem[];
  report: Record<string, unknown> | null;
};

const records = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
  : [];

const safeText = (value: unknown, fallback = 'Non renseigné') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function buildResultCorrection(type: ActivityType, content: Record<string, unknown>, answers: unknown, activityCorrection = ''): ResultCorrection {
  const answerList = Array.isArray(answers) ? answers : [];
  if (type === 'quiz' || type === 'tv-quiz') {
    const questions = records(content.questions);
    return {
      kind: 'graded',
      summary: activityCorrection || 'Comparez chaque réponse avec la solution et son explication.',
      report: null,
      items: questions.map((question, index) => {
        const choices = Array.isArray(question.choices) ? question.choices.map(String) : [];
        const expectedIndex = Number(question.correctIndex ?? 0);
        const selectedIndex = Number(answerList[index]);
        return {
          prompt: safeText(question.question, `Question ${index + 1}`),
          learnerAnswer: Number.isInteger(selectedIndex) && choices[selectedIndex] ? choices[selectedIndex] : 'Sans réponse',
          expectedAnswer: choices[expectedIndex] || 'Solution non renseignée',
          correct: Number.isInteger(selectedIndex) ? selectedIndex === expectedIndex : false,
          explanation: safeText(question.explanation, activityCorrection || 'Relisez la notion associée à cette question.'),
        };
      }),
    };
  }
  if (type === 'true-false') {
    const statements = records(content.statements);
    return {
      kind: 'graded',
      summary: activityCorrection || 'Chaque affirmation est corrigée et expliquée ci-dessous.',
      report: null,
      items: statements.map((statement, index) => {
        const expected = Boolean(statement.answer);
        const selected = answerList[index];
        return {
          prompt: safeText(statement.text, `Affirmation ${index + 1}`),
          learnerAnswer: typeof selected === 'boolean' ? (selected ? 'Vrai' : 'Faux') : 'Sans réponse',
          expectedAnswer: expected ? 'Vrai' : 'Faux',
          correct: typeof selected === 'boolean' ? selected === expected : false,
          explanation: safeText(statement.explanation, activityCorrection || 'Relisez la règle qui permet de trancher.'),
        };
      }),
    };
  }
  if (type === 'drag-drop' || type === 'matching') {
    const game = normalizeDragDropContent(type === 'matching' ? {...content,mode:'association'} : content);
    const placements = new Map(records(answerList).map((answer) => [String(answer.itemId ?? ''),String(answer.targetId ?? '')]));
    return {
      kind: 'graded',
      summary: activityCorrection || 'Retrouvez pour chaque étiquette la zone ou la définition attendue.',
      report: null,
      items: game.items.map((item) => {
        const learnerTarget = game.targets.find((target) => target.id === placements.get(item.id));
        const expectedTarget = game.targets.find((target) => target.id === item.targetId);
        return {
          prompt: item.label,
          learnerAnswer: learnerTarget?.label || 'Sans réponse',
          expectedAnswer: expectedTarget?.label || 'Zone attendue non renseignée',
          correct: Boolean(learnerTarget && learnerTarget.id === item.targetId),
          explanation: item.explanation || expectedTarget?.description || activityCorrection || 'Reprenez l’association attendue.',
        };
      }),
    };
  }
  if (type === 'scenario') {
    const scenario = normalizeScenarioContent(content);
    const decisions = records(answerList);
    return {
      kind: 'graded',
      summary: scenario.debrief.summary || activityCorrection || 'Analyse des décisions prises dans la mise en situation.',
      report: null,
      items: decisions.map((decision, index) => {
        const scene = scenario.scenes.find((item) => item.id === decision.sceneId);
        const choice = scene?.choices.find((item) => item.id === decision.choiceId);
        const recommended = scene?.choices.find((item) => item.score === Math.max(...scene.choices.map((item) => item.score)));
        return {
          prompt: safeText(decision.sceneTitle, scene?.title || `Situation ${index + 1}`),
          learnerAnswer: safeText(decision.choiceText, choice?.text),
          expectedAnswer: recommended?.text || choice?.recommendedConduct || 'Conduite recommandée non renseignée',
          correct: Number(decision.score ?? choice?.score ?? 0) === 2,
          explanation: choice?.explanation || choice?.consequence || activityCorrection || 'Analysez la conséquence de cette décision.',
        };
      }),
    };
  }
  if (type === 'voice-coach') {
    const report = records(answerList).find((item) => item.kind === 'voice-coach-report') ?? null;
    return {
      kind: 'report',
      summary: safeText(report?.summary, activityCorrection || 'Bilan de la séance de conversation.'),
      report,
      items: [],
    };
  }
  return {kind:'manual',summary:activityCorrection || 'Activité terminée. La validation repose sur la consigne du formateur.',items:[],report:null};
}
