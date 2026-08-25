import { env } from 'cloudflare:workers';

type LegacyActivity = { id:number; title:string; type:string; theme:string; duration:number; questions_json:string; source:string | null; created_at:string | number; research_json:string | null; quality_json:string | null; image_key:string | null };
type LegacyResult = { id:number; learner_name:string; activity_title:string; score:number; max_score:number; duration_seconds:number; answers_json:string; completed_at:string | number };

function unixTime(value: string | number) { const parsed = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(parsed) ? Math.floor(parsed > 10_000_000_000 ? parsed / 1000 : parsed) : Math.floor(Date.now()/1000); }
function parseJson(value: string | null, fallback: unknown) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }

export async function migrateLegacyData(trainerId: string) {
  const tableRows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('activities','results')").all<{name:string}>();
  const names = new Set(tableRows.results.map((row) => row.name));
  if (!names.has('activities')) return { activities:0,results:0 };
  const legacyActivities = (await env.DB.prepare('SELECT id,title,type,theme,duration,questions_json,source,created_at,research_json,quality_json,image_key FROM activities').all<LegacyActivity>()).results;
  const statements: D1PreparedStatement[] = [];
  const idsByTitle = new Map<string,string>();
  for (const row of legacyActivities) {
    const id = `legacy-activity-${row.id}`; idsByTitle.set(row.title,id);
    const questions = (Array.isArray(parseJson(row.questions_json,[])) ? parseJson(row.questions_json,[]) : []) as Array<Record<string,unknown>>;
    const content = { questions:questions.map((question) => ({ question:String(question.question ?? 'Question importée'),choices:Array.isArray(question.choices) ? question.choices : Array.isArray(question.options) ? question.options : ['Oui','Non'],correctIndex:Number(question.correctIndex ?? question.correct ?? 0),explanation:String(question.explanation ?? '') })) };
    const quality = parseJson(row.quality_json, {}) as Record<string,unknown>;
    const createdAt = unixTime(row.created_at);
    const draft = { type:'quiz',title:row.title,theme:row.theme,audience:'',level:'debutant',objectives:['Reprendre le contenu de l’activité historique'],durationMinutes:Math.max(1,Number(row.duration)||10),instructions:`Activité « ${row.type} » importée depuis la version précédente.`,explanation:'',correction:'',sources:[],content };
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO pedago_activities (id,trainer_id,type,title,theme,audience,level,objectives_json,duration_minutes,instructions,content_json,explanation,correction,sources_json,image_object_key,status,quality_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,trainerId,'quiz',row.title,row.theme,'','debutant',JSON.stringify(draft.objectives),draft.durationMinutes,draft.instructions,JSON.stringify(content),'','',JSON.stringify([]),row.image_key,'draft',Math.max(0,Math.min(100,Number(quality.score)||70)),createdAt,createdAt));
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO activity_contents (id,activity_id,version,content_json,created_at) VALUES (?,?,?,?,?)').bind(`legacy-content-${row.id}`,id,1,JSON.stringify(draft),createdAt));
  }
  let importedResults = 0;
  if (names.has('results')) {
    const rows = (await env.DB.prepare('SELECT id,learner_name,activity_title,score,max_score,duration_seconds,answers_json,completed_at FROM results').all<LegacyResult>()).results;
    for (const row of rows) {
      const activityId = idsByTitle.get(row.activity_title); if (!activityId) continue;
      const parts = String(row.learner_name ?? 'Apprenant').trim().split(/\s+/); const firstName = parts.shift() || 'Apprenant'; const lastName = parts.join(' ') || '—'; const maxScore = Math.max(1,Number(row.max_score)||1); const score = Math.max(0,Math.min(maxScore,Number(row.score)||0));
      statements.push(env.DB.prepare('INSERT OR IGNORE INTO learner_results (id,activity_id,trainer_id,learner_first_name,learner_last_name,answers_json,score,max_score,percentage,duration_seconds,attempt,self_evaluation,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(`legacy-result-${row.id}`,activityId,trainerId,firstName,lastName,row.answers_json || '[]',score,maxScore,Math.round(score/maxScore*100),Math.max(0,Number(row.duration_seconds)||0),1,null,unixTime(row.completed_at)));
      importedResults += 1;
    }
  }
  if (statements.length) await env.DB.batch(statements);
  return { activities:legacyActivities.length,results:importedResults };
}
