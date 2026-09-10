import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolderFiles, courseFolders, learningPathItems, learningPaths, mainFolders, uploadedFiles } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { normalizeFolderActivityIds, normalizeFolderColor, normalizeFolderCoverUrl, normalizeFolderFileIds, normalizeFolderLongDescription, normalizeFolderName, normalizeFolderText, normalizeFolderTextList, normalizePathItemSettings, normalizeTrainingDuration, normalizeTrainingLevel, normalizeTrainingStatus } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

async function ownedFolder(id:string,userId:string) { const folder=(await getDb().select().from(courseFolders).where(and(eq(courseFolders.id,id),eq(courseFolders.trainerId,userId))).limit(1))[0]; if(!folder) throw new AppError(404,'Cette formation est introuvable.','TRAINING_NOT_FOUND'); return folder; }
async function ownedPath(trainingId:string,userId:string) { return (await getDb().select().from(learningPaths).where(and(eq(learningPaths.trainingId,trainingId),eq(learningPaths.trainerId,userId))).limit(1))[0] ?? null; }

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request); const user=await requirePermission('editActivities'); const id=(await context.params).id; const folder=await ownedFolder(id,user.id); const body=await readJson(request); const now=Math.floor(Date.now()/1000);
    const changes:{mainFolderId?:string;name?:string;description?:string;color?:'mint'|'blue'|'peach'|'aqua';audience?:string;level?:'debutant'|'intermediaire'|'avance';prerequisitesJson?:string;objectivesJson?:string;competenciesJson?:string;durationMinutes?:number;coverImageUrl?:string|null;status?:'draft'|'ready'|'published'|'archived';updatedAt:number}={updatedAt:now};
    if ('mainFolderId' in body) { const mainFolderId=String(body.mainFolderId??'').trim(); const theme=(await getDb().select({id:mainFolders.id}).from(mainFolders).where(and(eq(mainFolders.id,mainFolderId),eq(mainFolders.trainerId,user.id))).limit(1))[0]; if(!theme) throw new AppError(404,'Le dossier métier ou thématique de destination est introuvable.','MAIN_FOLDER_NOT_FOUND'); changes.mainFolderId=mainFolderId; }
    if ('name' in body) { const name=normalizeFolderName(body.name); if(name.length<2) throw new AppError(400,'Donnez un titre d’au moins deux caractères à la formation.','TRAINING_NAME_REQUIRED'); changes.name=name; }
    if ('description' in body) changes.description=normalizeFolderLongDescription(body.description);
    if ('color' in body) changes.color=normalizeFolderColor(body.color);
    if ('audience' in body) changes.audience=normalizeFolderText(body.audience,220);
    if ('level' in body) changes.level=normalizeTrainingLevel(body.level);
    if ('prerequisites' in body) changes.prerequisitesJson=JSON.stringify(normalizeFolderTextList(body.prerequisites));
    if ('objectives' in body) changes.objectivesJson=JSON.stringify(normalizeFolderTextList(body.objectives));
    if ('competencies' in body) changes.competenciesJson=JSON.stringify(normalizeFolderTextList(body.competencies));
    if ('durationMinutes' in body) changes.durationMinutes=normalizeTrainingDuration(body.durationMinutes);
    if ('coverImageUrl' in body) changes.coverImageUrl=normalizeFolderCoverUrl(body.coverImageUrl);
    if ('status' in body) changes.status=normalizeTrainingStatus(body.status);
    let path=await ownedPath(id,user.id); const statements:unknown[]=[getDb().update(courseFolders).set(changes).where(and(eq(courseFolders.id,id),eq(courseFolders.trainerId,user.id)))];
    if (!path) { path={id:crypto.randomUUID(),trainerId:user.id,trainingId:id,name:`Parcours · ${changes.name??folder.name}`,status:'draft',createdAt:now,updatedAt:now}; statements.push(getDb().insert(learningPaths).values(path)); }
    else if (changes.name) statements.push(getDb().update(learningPaths).set({name:`Parcours · ${changes.name}`,updatedAt:now}).where(and(eq(learningPaths.id,path.id),eq(learningPaths.trainerId,user.id))));
    const requestedItems='pathItems' in body ? normalizePathItemSettings(body.pathItems) : 'activityIds' in body ? normalizeFolderActivityIds(body.activityIds).map((activityId)=>({activityId,required:true,minScore:0,unlockAfterPrevious:true})) : null;
    if (requestedItems) {
      const activityIds=requestedItems.map((item)=>item.activityId); const ownedIds=activityIds.length ? await getDb().select({id:activities.id}).from(activities).where(and(eq(activities.trainerId,user.id),inArray(activities.id,activityIds))) : [];
      if(ownedIds.length!==activityIds.length) throw new AppError(400,'Une activité sélectionnée n’appartient pas à votre bibliothèque.','FOREIGN_PATH_ACTIVITY');
      statements.push(getDb().delete(learningPathItems).where(eq(learningPathItems.pathId,path.id)));
      requestedItems.forEach((item,position)=>statements.push(getDb().insert(learningPathItems).values({id:crypto.randomUUID(),pathId:path!.id,activityId:item.activityId,position,required:item.required,minScore:item.minScore,unlockAfterPrevious:item.unlockAfterPrevious,createdAt:now,updatedAt:now})));
      statements.push(getDb().update(learningPaths).set({updatedAt:now}).where(eq(learningPaths.id,path.id)));
    }
    if ('fileIds' in body) {
      const fileIds=normalizeFolderFileIds(body.fileIds); const ownedIds=fileIds.length ? await getDb().select({id:uploadedFiles.id}).from(uploadedFiles).where(and(eq(uploadedFiles.trainerId,user.id),inArray(uploadedFiles.id,fileIds))) : [];
      if(ownedIds.length!==fileIds.length) throw new AppError(400,'Un support sélectionné n’appartient pas à votre bibliothèque.','FOREIGN_TRAINING_FILE');
      statements.push(getDb().delete(courseFolderFiles).where(eq(courseFolderFiles.folderId,id)));
      fileIds.forEach((fileId,position)=>statements.push(getDb().insert(courseFolderFiles).values({id:crypto.randomUUID(),folderId:id,fileId,position,createdAt:now})));
    }
    if (changes.status) {
      statements.push(getDb().update(learningPaths).set({status:changes.status==='published'?'published':'draft',updatedAt:now}).where(eq(learningPaths.id,path.id)));
      if (changes.status === 'published') {
        const activityIds = requestedItems?.map((item) => item.activityId) ?? (await getDb().select({ activityId: learningPathItems.activityId }).from(learningPathItems).where(eq(learningPathItems.pathId, path.id))).map((item) => item.activityId);
        if (activityIds.length) statements.push(getDb().update(activities).set({ status: 'published', updatedAt: now }).where(and(eq(activities.trainerId,user.id),inArray(activities.id,activityIds))));
      }
    }
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    await audit(user.id,'training.updated','course_folder',id,{pathUpdated:requestedItems!==null,previousName:folder.name},request);
    return jsonOk({message:requestedItems!==null?'Le parcours, ses règles et l’ordre des activités sont enregistrés.':'La formation est enregistrée.'});
  } catch(error) { return jsonError(error); }
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) {
  try { assertSameOrigin(request); const user=await requirePermission('editActivities'); const id=(await context.params).id; const folder=await ownedFolder(id,user.id); await getDb().delete(courseFolders).where(and(eq(courseFolders.id,id),eq(courseFolders.trainerId,user.id))); await audit(user.id,'training.deleted','course_folder',id,{name:folder.name,activitiesPreserved:true},request); return jsonOk({message:'La formation et son parcours sont supprimés. Les activités et documents restent disponibles dans vos bibliothèques.'}); } catch(error) { return jsonError(error); }
}

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request); const user=await requirePermission('editActivities'); const sourceId=(await context.params).id; const source=await ownedFolder(sourceId,user.id); const sourcePath=await ownedPath(sourceId,user.id); const now=Math.floor(Date.now()/1000); const id=crypto.randomUUID(); const pathId=crypto.randomUUID();
    const [items,files]=await Promise.all([sourcePath?getDb().select().from(learningPathItems).where(eq(learningPathItems.pathId,sourcePath.id)).orderBy(learningPathItems.position):[],getDb().select().from(courseFolderFiles).where(eq(courseFolderFiles.folderId,sourceId)).orderBy(courseFolderFiles.position)]);
    const statements:unknown[]=[getDb().insert(courseFolders).values({...source,id,name:`${source.name} — copie`,status:'draft',createdAt:now,updatedAt:now}),getDb().insert(learningPaths).values({id:pathId,trainerId:user.id,trainingId:id,name:`Parcours · ${source.name} — copie`,status:'draft',createdAt:now,updatedAt:now})];
    items.forEach((item,position)=>statements.push(getDb().insert(learningPathItems).values({id:crypto.randomUUID(),pathId,activityId:item.activityId,position,required:item.required,minScore:item.minScore,unlockAfterPrevious:item.unlockAfterPrevious,createdAt:now,updatedAt:now})));
    files.forEach((file,position)=>statements.push(getDb().insert(courseFolderFiles).values({id:crypto.randomUUID(),folderId:id,fileId:file.fileId,position,createdAt:now})));
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]); await audit(user.id,'training.duplicated','course_folder',id,{sourceId},request); return jsonOk({id,message:'La formation et son parcours ont été dupliqués.'},201);
  } catch(error) { return jsonError(error); }
}
