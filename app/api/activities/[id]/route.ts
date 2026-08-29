import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, activityContents, scenarioChoices, scenarioScenes } from '@/db/schema';
import { assertPermission, audit, requirePermission, requireUser } from '@/lib/auth';
import { ActivityDraft, validateActivityDraft } from '@/lib/activity-types';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

async function owned(id: string, userId: string) { const row = (await getDb().select().from(activities).where(and(eq(activities.id, id), eq(activities.trainerId, userId))).limit(1))[0]; if (!row) throw new AppError(404, 'Cette activité est introuvable.', 'ACTIVITY_NOT_FOUND'); return row; }
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const row = await owned((await context.params).id, user.id); return jsonOk({ activity: { ...row, objectives: JSON.parse(row.objectivesJson), content: JSON.parse(row.contentJson), sources: JSON.parse(row.sourcesJson) } }); } catch (error) { return jsonError(error); } }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const id = (await context.params).id; await owned(id, user.id); const body = await readJson(request);
    if (body.status === 'published') assertPermission(user, 'publishActivities');
    const draft = body as unknown as ActivityDraft; const validation = validateActivityDraft(draft);
    if (!validation.valid) throw new AppError(400, validation.errors.join(' '), 'INVALID_ACTIVITY');
    const now = Math.floor(Date.now() / 1000); const version = now;
    const statements: unknown[] = [
      getDb().update(activities).set({ type: draft.type, title: draft.title, theme: draft.theme, audience: draft.audience, level: draft.level, objectivesJson: JSON.stringify(draft.objectives), durationMinutes: draft.durationMinutes, instructions: draft.instructions, contentJson: JSON.stringify(draft.content), explanation: draft.explanation, correction: draft.correction, sourcesJson: JSON.stringify(draft.sources), status: body.status === 'published' ? 'published' : 'draft', updatedAt: now }).where(and(eq(activities.id, id), eq(activities.trainerId, user.id))),
      getDb().insert(activityContents).values({ id: crypto.randomUUID(), activityId: id, version, contentJson: JSON.stringify(draft) }),
      getDb().delete(scenarioScenes).where(and(eq(scenarioScenes.activityId,id),eq(scenarioScenes.trainerId,user.id))),
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
    await audit(user.id, 'activity.updated', 'activity', id, {}, request);
    return jsonOk({ message: 'Les modifications sont enregistrées.' });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const user = await requirePermission('deleteActivities'); const id = (await context.params).id; const row = await owned(id, user.id); if (new URL(request.url).searchParams.get('deleteFiles') === 'true' && row.imageObjectKey) await env.FILES.delete(row.imageObjectKey); await getDb().delete(activities).where(and(eq(activities.id, id), eq(activities.trainerId, user.id))); await audit(user.id, 'activity.deleted', 'activity', id, { filesDeleted: Boolean(row.imageObjectKey) }, request); return jsonOk({ message: 'L’activité a été supprimée de votre bibliothèque.' }); } catch (error) { return jsonError(error); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const user = await requirePermission('createActivities'); const source = await owned((await context.params).id, user.id); const id = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000); await getDb().insert(activities).values({ ...source, id, title: `${source.title} — copie`, status: 'draft', createdAt: now, updatedAt: now }); await audit(user.id, 'activity.duplicated', 'activity', id, { sourceId: source.id }, request); return jsonOk({ id, message: 'Une copie a été ajoutée à votre bibliothèque.' }, 201); } catch (error) { return jsonError(error); }
}
