import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolderFiles, courseFolderItems, courseFolders, uploadedFiles } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { normalizeFolderActivityIds, normalizeFolderColor, normalizeFolderDescription, normalizeFolderFileIds, normalizeFolderName } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

async function ownedFolder(id: string,userId: string) {
  const folder = (await getDb().select().from(courseFolders).where(and(eq(courseFolders.id,id),eq(courseFolders.trainerId,userId))).limit(1))[0];
  if (!folder) throw new AppError(404,'Ce dossier est introuvable.','FOLDER_NOT_FOUND');
  return folder;
}

export async function PATCH(request: Request,context: {params: Promise<{id:string}>}) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const id = (await context.params).id; const folder = await ownedFolder(id,user.id); const body = await readJson(request); const now = Math.floor(Date.now() / 1000);
    const changes: {name?:string;description?:string;color?:'mint'|'blue'|'peach'|'aqua';updatedAt:number} = {updatedAt:now};
    if ('name' in body) { const name = normalizeFolderName(body.name); if (name.length < 2) throw new AppError(400,'Donnez un nom d’au moins deux caractères au dossier.','FOLDER_NAME_REQUIRED'); changes.name = name; }
    if ('description' in body) changes.description = normalizeFolderDescription(body.description);
    if ('color' in body) changes.color = normalizeFolderColor(body.color);
    const statements: unknown[] = [getDb().update(courseFolders).set(changes).where(and(eq(courseFolders.id,id),eq(courseFolders.trainerId,user.id)))];
    let activityIds: string[] | null = null;
    if ('activityIds' in body) {
      activityIds = normalizeFolderActivityIds(body.activityIds);
      if (Array.isArray(body.activityIds) && activityIds.length !== new Set(body.activityIds.map(String)).size) throw new AppError(400,'La liste des activités contient un identifiant invalide.','INVALID_FOLDER_ACTIVITIES');
      const ownedIds = activityIds.length ? await getDb().select({id:activities.id}).from(activities).where(and(eq(activities.trainerId,user.id),inArray(activities.id,activityIds))) : [];
      if (ownedIds.length !== activityIds.length) throw new AppError(400,'Une activité sélectionnée n’appartient pas à votre bibliothèque.','FOREIGN_FOLDER_ACTIVITY');
      statements.push(getDb().delete(courseFolderItems).where(eq(courseFolderItems.folderId,id)));
      activityIds.forEach((activityId,position) => statements.push(getDb().insert(courseFolderItems).values({id:crypto.randomUUID(),folderId:id,activityId,position,createdAt:now})));
    }
    let fileIds: string[] | null = null;
    if ('fileIds' in body) {
      fileIds = normalizeFolderFileIds(body.fileIds);
      if (Array.isArray(body.fileIds) && fileIds.length !== new Set(body.fileIds.map(String)).size) throw new AppError(400,'La liste des supports contient un identifiant invalide.','INVALID_FOLDER_FILES');
      const ownedIds = fileIds.length ? await getDb().select({id:uploadedFiles.id}).from(uploadedFiles).where(and(eq(uploadedFiles.trainerId,user.id),inArray(uploadedFiles.id,fileIds))) : [];
      if (ownedIds.length !== fileIds.length) throw new AppError(400,'Un support sélectionné n’appartient pas à votre bibliothèque.','FOREIGN_FOLDER_FILE');
      statements.push(getDb().delete(courseFolderFiles).where(eq(courseFolderFiles.folderId,id)));
      fileIds.forEach((fileId,position) => statements.push(getDb().insert(courseFolderFiles).values({id:crypto.randomUUID(),folderId:id,fileId,position,createdAt:now})));
    }
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    const contentUpdated = activityIds !== null || fileIds !== null;
    await audit(user.id,'folder.updated','course_folder',id,{renamed:changes.name !== undefined,activityCount:activityIds?.length ?? undefined,fileCount:fileIds?.length ?? undefined,previousName:folder.name},request);
    return jsonOk({message:contentUpdated ? 'Le contenu du dossier et l’ordre des activités sont enregistrés.' : 'Le dossier est renommé et enregistré.'});
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request,context: {params: Promise<{id:string}>}) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const id = (await context.params).id; const folder = await ownedFolder(id,user.id);
    await getDb().delete(courseFolders).where(and(eq(courseFolders.id,id),eq(courseFolders.trainerId,user.id)));
    await audit(user.id,'folder.deleted','course_folder',id,{name:folder.name,activitiesPreserved:true},request);
    return jsonOk({message:'Le dossier est supprimé. Les activités et supports restent dans votre bibliothèque.'});
  } catch (error) { return jsonError(error); }
}
