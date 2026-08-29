import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, externalResources } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { normalizeExternalResource } from '@/lib/external-resources';
export async function GET() { try { const user = await requirePermission('manageResources'); return jsonOk({ resources: await getDb().select().from(externalResources).where(eq(externalResources.trainerId, user.id)).orderBy(desc(externalResources.createdAt)) }); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try {
  assertSameOrigin(request); const user = await requirePermission('manageResources'); const body = await readJson(request); const value = normalizeExternalResource(body);
  if (value.trainingId) { const training = (await getDb().select({id:courseFolders.id}).from(courseFolders).where(and(eq(courseFolders.id,value.trainingId),eq(courseFolders.trainerId,user.id))).limit(1))[0]; if(!training) throw new AppError(404,'Cette formation est introuvable.','RESOURCE_TRAINING_NOT_FOUND'); }
  if (value.activityId) { const activity = (await getDb().select({id:activities.id}).from(activities).where(and(eq(activities.id,value.activityId),eq(activities.trainerId,user.id))).limit(1))[0]; if(!activity) throw new AppError(404,'Cette activité est introuvable.','RESOURCE_ACTIVITY_NOT_FOUND'); }
  const id = crypto.randomUUID(); await getDb().insert(externalResources).values({ id, trainerId: user.id, ...value }); await audit(user.id, 'resource.created', 'external_resource', id, { provider:value.provider,trainingId:value.trainingId,activityId:value.activityId }, request); return jsonOk({ id, message: 'La ressource est enregistrée et liée au bon niveau pédagogique.' }, 201);
} catch (error) { return jsonError(error); } }
export async function DELETE(request: Request) { try { assertSameOrigin(request); const user = await requirePermission('manageResources'); const id = new URL(request.url).searchParams.get('id') ?? ''; const deleted = await getDb().delete(externalResources).where(and(eq(externalResources.id, id), eq(externalResources.trainerId, user.id))).returning({ id: externalResources.id }); if (!deleted.length) throw new AppError(404, 'Cette ressource est introuvable.', 'RESOURCE_NOT_FOUND'); await audit(user.id, 'resource.deleted', 'external_resource', id, {}, request); return jsonOk({ message: 'La ressource a été supprimée.' }); } catch (error) { return jsonError(error); } }
