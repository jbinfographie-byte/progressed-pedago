import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolders, mainFolderFiles, mainFolders, uploadedFiles } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { normalizeFolderColor, normalizeFolderCoverUrl, normalizeFolderFileIds, normalizeFolderLongDescription, normalizeFolderName, normalizeFolderText, normalizeFolderTextList } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

async function owned(id:string,userId:string) { const row = (await getDb().select().from(mainFolders).where(and(eq(mainFolders.id,id),eq(mainFolders.trainerId,userId))).limit(1))[0]; if (!row) throw new AppError(404,'Ce dossier métier ou thématique est introuvable.','MAIN_FOLDER_NOT_FOUND'); return row; }

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const id = (await context.params).id; await owned(id,user.id); const body = await readJson(request); const now = Math.floor(Date.now() / 1000);
    const changes:{name?:string;description?:string;sector?:string;audience?:string;coverImageUrl?:string|null;color?:'mint'|'blue'|'peach'|'aqua';keywordsJson?:string;competenciesJson?:string;updatedAt:number}={updatedAt:now};
    if ('name' in body) { const name=normalizeFolderName(body.name); if(name.length<2) throw new AppError(400,'Donnez un nom d’au moins deux caractères au métier ou au thème.','MAIN_FOLDER_NAME_REQUIRED'); changes.name=name; }
    if ('description' in body) changes.description=normalizeFolderLongDescription(body.description);
    if ('sector' in body) changes.sector=normalizeFolderText(body.sector,180);
    if ('audience' in body) changes.audience=normalizeFolderText(body.audience,220);
    if ('coverImageUrl' in body) changes.coverImageUrl=normalizeFolderCoverUrl(body.coverImageUrl);
    if ('color' in body) changes.color=normalizeFolderColor(body.color);
    if ('keywords' in body) changes.keywordsJson=JSON.stringify(normalizeFolderTextList(body.keywords));
    if ('competencies' in body) changes.competenciesJson=JSON.stringify(normalizeFolderTextList(body.competencies));
    const statements:unknown[]=[getDb().update(mainFolders).set(changes).where(and(eq(mainFolders.id,id),eq(mainFolders.trainerId,user.id)))];
    if ('fileIds' in body) {
      const fileIds=normalizeFolderFileIds(body.fileIds); const ownedIds=fileIds.length ? await getDb().select({id:uploadedFiles.id}).from(uploadedFiles).where(and(eq(uploadedFiles.trainerId,user.id),inArray(uploadedFiles.id,fileIds))) : [];
      if (ownedIds.length!==fileIds.length) throw new AppError(400,'Un document sélectionné n’appartient pas à votre bibliothèque.','FOREIGN_MAIN_FOLDER_FILE');
      statements.push(getDb().delete(mainFolderFiles).where(eq(mainFolderFiles.mainFolderId,id)));
      fileIds.forEach((fileId,position)=>statements.push(getDb().insert(mainFolderFiles).values({id:crypto.randomUUID(),mainFolderId:id,fileId,position,createdAt:now})));
    }
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    await audit(user.id,'main_folder.updated','main_folder',id,{},request);
    return jsonOk({message:'Le dossier métier ou thématique est enregistré.'});
  } catch(error) { return jsonError(error); }
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request); const user=await requirePermission('editActivities'); const id=(await context.params).id; const row=await owned(id,user.id); const now=Math.floor(Date.now()/1000);
    const children=await getDb().select({id:courseFolders.id}).from(courseFolders).where(and(eq(courseFolders.mainFolderId,id),eq(courseFolders.trainerId,user.id)));
    const statements:unknown[]=[]; let recoveryId:string|null=null;
    if(children.length){ const existing=(await getDb().select({id:mainFolders.id}).from(mainFolders).where(and(eq(mainFolders.trainerId,user.id),eq(mainFolders.name,'Formations à reclasser'))).limit(1))[0]; recoveryId=existing?.id??crypto.randomUUID(); if(!existing) statements.push(getDb().insert(mainFolders).values({id:recoveryId,trainerId:user.id,name:'Formations à reclasser',description:'Formations conservées après la suppression de leur ancien dossier principal.',sector:'',audience:'',coverImageUrl:null,color:'aqua',keywordsJson:'[]',competenciesJson:'[]',createdAt:now,updatedAt:now})); statements.push(getDb().update(courseFolders).set({mainFolderId:recoveryId,updatedAt:now}).where(and(eq(courseFolders.mainFolderId,id),eq(courseFolders.trainerId,user.id)))); }
    statements.push(getDb().delete(mainFolders).where(and(eq(mainFolders.id,id),eq(mainFolders.trainerId,user.id)))); await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    await audit(user.id,'main_folder.deleted','main_folder',id,{name:row.name,trainingsPreserved:true,recoveryId},request); return jsonOk({message:children.length?'Le dossier principal est supprimé. Ses formations ont été déplacées dans « Formations à reclasser ».':'Le dossier principal est supprimé.'});
  } catch(error) { return jsonError(error); }
}
