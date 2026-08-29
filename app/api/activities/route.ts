import { and, desc, eq, like, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, activityContents, scenarioChoices, scenarioScenes } from '@/db/schema';
import { assertPermission, audit, requirePermission, requireUser } from '@/lib/auth';
import { ActivityDraft, isCreatableActivityType, validateActivityDraft } from '@/lib/activity-types';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url); const type = url.searchParams.get('type'); const status = url.searchParams.get('status'); const search = url.searchParams.get('search')?.trim();
    const clauses = [eq(activities.trainerId, user.id)];
    if (type) clauses.push(eq(activities.type, type));
    if (status === 'draft' || status === 'published') clauses.push(eq(activities.status, status));
    if (search) clauses.push(or(like(activities.title, `%${search}%`), like(activities.theme, `%${search}%`))!);
    const rows = await getDb().select().from(activities).where(and(...clauses)).orderBy(desc(activities.updatedAt));
    return jsonOk({ activities: rows.map((row) => ({ ...row, objectives: JSON.parse(row.objectivesJson), content: JSON.parse(row.contentJson), sources: JSON.parse(row.sourcesJson) })) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('createActivities'); const body = await readJson(request); const draft = body as unknown as ActivityDraft;
    if (body.status === 'published') assertPermission(user, 'publishActivities');
    if (!isCreatableActivityType(draft.type)) throw new AppError(400, 'Ce format n’est plus proposé à la création.', 'ACTIVITY_TYPE_NOT_CREATABLE');
    const validation = validateActivityDraft(draft); if (!validation.valid) throw new AppError(400, validation.errors.join(' '), 'INVALID_ACTIVITY');
    const id = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000); const status = body.status === 'published' ? 'published' : 'draft';
    const statements: unknown[] = [
      getDb().insert(activities).values({ id, trainerId: user.id, type: draft.type, title: draft.title.trim(), theme: draft.theme.trim(), audience: draft.audience.trim(), level: draft.level, objectivesJson: JSON.stringify(draft.objectives), durationMinutes: draft.durationMinutes, instructions: draft.instructions, contentJson: JSON.stringify(draft.content), explanation: draft.explanation, correction: draft.correction, sourcesJson: JSON.stringify(draft.sources), status, qualityScore: 85, createdAt: now, updatedAt: now }),
      getDb().insert(activityContents).values({ id: crypto.randomUUID(), activityId: id, version: 1, contentJson: JSON.stringify(draft) }),
    ];
    if (draft.type === 'scenario' && Array.isArray(draft.content.scenes)) for (const [sceneIndex,sceneValue] of draft.content.scenes.entries()) {
      if (!sceneValue || typeof sceneValue !== 'object') continue;
      const scene = sceneValue as Record<string,unknown>; const sceneRowId = crypto.randomUUID();
      statements.push(getDb().insert(scenarioScenes).values({ id:sceneRowId,trainerId:user.id,activityId:id,projectId:null,position:sceneIndex,title:String(scene.title ?? `Situation ${sceneIndex + 1}`).slice(0,300),contentJson:JSON.stringify(scene),sourcesJson:JSON.stringify(Array.isArray(scene.sources) ? scene.sources : []),createdAt:now,updatedAt:now }));
      for (const [choiceIndex,choiceValue] of (Array.isArray(scene.choices) ? scene.choices : []).entries()) {
        if (!choiceValue || typeof choiceValue !== 'object') continue;
        const choice = choiceValue as Record<string,unknown>; const score = Math.min(2,Math.max(0,Number(choice.score) || 0));
        statements.push(getDb().insert(scenarioChoices).values({ id:crypto.randomUUID(),trainerId:user.id,sceneId:sceneRowId,position:choiceIndex,score,contentJson:JSON.stringify(choice),createdAt:now,updatedAt:now }));
      }
    }
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    await audit(user.id, 'activity.created', 'activity', id, { type: draft.type, status }, request);
    return jsonOk({ id, message: 'L’activité est enregistrée dans votre bibliothèque.' }, 201);
  } catch (error) { return jsonError(error); }
}
