import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolderFiles, courseFolders, externalResources, learningPathItems, learningPaths, mainFolderFiles, mainFolders, uploadedFiles } from '@/db/schema';
import { audit, requirePermission, requireUser } from '@/lib/auth';
import { normalizeFolderColor, normalizeFolderCoverUrl, normalizeFolderLongDescription, normalizeFolderName, normalizeFolderText, normalizeFolderTextList, normalizeTrainingDuration, normalizeTrainingLevel, normalizeTrainingStatus } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET() {
  try {
    const user = await requireUser();
    const [themes,trainings,libraryFiles] = await Promise.all([
      getDb().select().from(mainFolders).where(eq(mainFolders.trainerId,user.id)).orderBy(desc(mainFolders.updatedAt)),
      getDb().select().from(courseFolders).where(eq(courseFolders.trainerId,user.id)).orderBy(desc(courseFolders.updatedAt)),
      getDb().select({id:uploadedFiles.id,originalName:uploadedFiles.originalName,mimeType:uploadedFiles.mimeType,sizeBytes:uploadedFiles.sizeBytes,status:uploadedFiles.status,createdAt:uploadedFiles.createdAt}).from(uploadedFiles).where(eq(uploadedFiles.trainerId,user.id)).orderBy(desc(uploadedFiles.createdAt)),
    ]);
    const paths = trainings.length ? await getDb().select().from(learningPaths).where(and(eq(learningPaths.trainerId,user.id),inArray(learningPaths.trainingId,trainings.map((training) => training.id)))) : [];
    const pathItems = paths.length ? await getDb().select().from(learningPathItems).where(inArray(learningPathItems.pathId,paths.map((path) => path.id))).orderBy(learningPathItems.position) : [];
    const trainingFiles = trainings.length ? await getDb().select().from(courseFolderFiles).where(inArray(courseFolderFiles.folderId,trainings.map((training) => training.id))).orderBy(courseFolderFiles.position) : [];
    const trainingResources = trainings.length ? await getDb().select().from(externalResources).where(and(eq(externalResources.trainerId,user.id),inArray(externalResources.trainingId,trainings.map((training) => training.id)))).orderBy(externalResources.createdAt) : [];
    const themeFiles = themes.length ? await getDb().select().from(mainFolderFiles).where(inArray(mainFolderFiles.mainFolderId,themes.map((theme) => theme.id))).orderBy(mainFolderFiles.position) : [];
    return jsonOk({
      mainFolders:themes.map((theme) => ({...theme,keywords:JSON.parse(theme.keywordsJson),competencies:JSON.parse(theme.competenciesJson),fileItems:themeFiles.filter((item) => item.mainFolderId === theme.id).map(({fileId,position}) => ({fileId,position}))})),
      folders:trainings.map((training) => { const path = paths.find((candidate) => candidate.trainingId === training.id); return {...training,prerequisites:JSON.parse(training.prerequisitesJson),objectives:JSON.parse(training.objectivesJson),competencies:JSON.parse(training.competenciesJson),fileItems:trainingFiles.filter((item) => item.folderId === training.id).map(({fileId,position}) => ({fileId,position})),resources:trainingResources.filter((item) => item.trainingId === training.id).map((item)=>({...item,metadata:JSON.parse(item.metadataJson)})),path:path ? {...path,items:pathItems.filter((item) => item.pathId === path.id).map(({activityId,position,required,minScore,unlockAfterPrevious}) => ({activityId,position,required,minScore,unlockAfterPrevious}))} : null}; }),
      libraryFiles,
    });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const body = await readJson(request);
    const mainFolderId = String(body.mainFolderId ?? '').trim();
    const theme = (await getDb().select({id:mainFolders.id}).from(mainFolders).where(and(eq(mainFolders.id,mainFolderId),eq(mainFolders.trainerId,user.id))).limit(1))[0];
    if (!theme) throw new AppError(404,'Le dossier métier ou thématique est introuvable.','MAIN_FOLDER_NOT_FOUND');
    const name = normalizeFolderName(body.name); if (name.length < 2) throw new AppError(400,'Donnez un titre d’au moins deux caractères à la formation.','TRAINING_NAME_REQUIRED');
    const id = crypto.randomUUID(); const pathId = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000);
    await getDb().batch([
      getDb().insert(courseFolders).values({id,trainerId:user.id,mainFolderId,name,description:normalizeFolderLongDescription(body.description),color:normalizeFolderColor(body.color),audience:normalizeFolderText(body.audience,220),level:normalizeTrainingLevel(body.level),prerequisitesJson:JSON.stringify(normalizeFolderTextList(body.prerequisites)),objectivesJson:JSON.stringify(normalizeFolderTextList(body.objectives)),competenciesJson:JSON.stringify(normalizeFolderTextList(body.competencies)),durationMinutes:normalizeTrainingDuration(body.durationMinutes),coverImageUrl:normalizeFolderCoverUrl(body.coverImageUrl),status:normalizeTrainingStatus(body.status),createdAt:now,updatedAt:now}),
      getDb().insert(learningPaths).values({id:pathId,trainerId:user.id,trainingId:id,name:`Parcours · ${name}`,status:'draft',createdAt:now,updatedAt:now}),
      getDb().update(mainFolders).set({updatedAt:now}).where(and(eq(mainFolders.id,mainFolderId),eq(mainFolders.trainerId,user.id))),
    ]);
    await audit(user.id,'training.created','course_folder',id,{name,mainFolderId},request);
    return jsonOk({id,pathId,message:'La formation et son parcours pédagogique sont créés.'},201);
  } catch (error) { return jsonError(error); }
}
