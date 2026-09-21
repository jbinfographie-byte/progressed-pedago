import { sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { activities, activityContents, learnerResults } from '@/db/schema';

type LegacyActivity = { id:number; title:string; type:string; theme:string; duration:number; questions_json:string; source:string | null; created_at:string | number; research_json:string | null; quality_json:string | null; image_key:string | null };
type LegacyResult = { id:number; learner_name:string; activity_title:string; score:number; max_score:number; duration_seconds:number; answers_json:string; completed_at:string | number };

function unixTime(value: string | number) {
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed > 10_000_000_000 ? parsed / 1000 : parsed) : Math.floor(Date.now() / 1000);
}

function parseJson(value: string | null, fallback: unknown) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export async function migrateLegacyData(trainerId: string) {
  const db = getDb();
  const tableResult = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name in ('activities', 'results')
  `);
  const names = new Set(tableResult.rows.map((row) => row.table_name));
  if (!names.has('activities')) return { activities: 0, results: 0 };

  const legacyResult = await db.execute<LegacyActivity>(sql.raw(
    'select id,title,type,theme,duration,questions_json,source,created_at,research_json,quality_json,image_key from activities',
  ));
  const statements = [];
  const idsByTitle = new Map<string, string>();

  for (const row of legacyResult.rows) {
    const id = `legacy-activity-${row.id}`;
    idsByTitle.set(row.title, id);
    const parsedQuestions = parseJson(row.questions_json, []);
    const questions = (Array.isArray(parsedQuestions) ? parsedQuestions : []) as Array<Record<string, unknown>>;
    const content = { questions: questions.map((question) => ({
      question: String(question.question ?? 'Question importée'),
      choices: Array.isArray(question.choices) ? question.choices : Array.isArray(question.options) ? question.options : ['Oui', 'Non'],
      correctIndex: Number(question.correctIndex ?? question.correct ?? 0),
      explanation: String(question.explanation ?? ''),
    })) };
    const quality = parseJson(row.quality_json, {}) as Record<string, unknown>;
    const createdAt = unixTime(row.created_at);
    const draft = {
      type: 'quiz', title: row.title, theme: row.theme, audience: '', level: 'debutant',
      objectives: ['Reprendre le contenu de l’activité historique'],
      durationMinutes: Math.max(1, Number(row.duration) || 10),
      instructions: `Activité « ${row.type} » importée depuis la version précédente.`,
      explanation: '', correction: '', sources: [], content,
    };
    statements.push(db.insert(activities).values({
      id, trainerId, type: 'quiz', title: row.title, theme: row.theme, audience: '', level: 'debutant',
      objectivesJson: JSON.stringify(draft.objectives), durationMinutes: draft.durationMinutes,
      instructions: draft.instructions, contentJson: JSON.stringify(content), explanation: '', correction: '',
      sourcesJson: '[]', imageObjectKey: row.image_key, status: 'draft',
      qualityScore: Math.max(0, Math.min(100, Number(quality.score) || 70)), createdAt, updatedAt: createdAt,
    }).onConflictDoNothing());
    statements.push(db.insert(activityContents).values({
      id: `legacy-content-${row.id}`, activityId: id, version: 1, contentJson: JSON.stringify(draft), createdAt,
    }).onConflictDoNothing());
  }

  let importedResults = 0;
  if (names.has('results')) {
    const results = await db.execute<LegacyResult>(sql.raw(
      'select id,learner_name,activity_title,score,max_score,duration_seconds,answers_json,completed_at from results',
    ));
    for (const row of results.rows) {
      const activityId = idsByTitle.get(row.activity_title);
      if (!activityId) continue;
      const parts = String(row.learner_name ?? 'Apprenant').trim().split(/\s+/);
      const firstName = parts.shift() || 'Apprenant';
      const lastName = parts.join(' ') || '—';
      const maxScore = Math.max(1, Number(row.max_score) || 1);
      const score = Math.max(0, Math.min(maxScore, Number(row.score) || 0));
      statements.push(db.insert(learnerResults).values({
        id: `legacy-result-${row.id}`, activityId, trainerId, learnerFirstName: firstName, learnerLastName: lastName,
        answersJson: row.answers_json || '[]', score, maxScore, percentage: Math.round(score / maxScore * 100),
        durationSeconds: Math.max(0, Number(row.duration_seconds) || 0), attempt: 1, selfEvaluation: null,
        createdAt: unixTime(row.completed_at),
      }).onConflictDoNothing());
      importedResults += 1;
    }
  }

  if (statements.length) await db.batch(statements);
  return { activities: legacyResult.rows.length, results: importedResults };
}
