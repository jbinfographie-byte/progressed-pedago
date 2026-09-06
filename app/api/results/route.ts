import { and, desc, eq, like, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, learnerResults, learningPathItems, learningPaths, mainFolders, trainingShares } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { buildResultCorrection } from '@/lib/result-corrections';
import type { ActivityType } from '@/lib/activity-types';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('viewResults');
    const params = new URL(request.url).searchParams;
    const search = params.get('search')?.trim();
    const activityId = params.get('activityId')?.trim();
    const trainingId = params.get('trainingId')?.trim();
    const mainFolderId = params.get('mainFolderId')?.trim();
    const shareId = params.get('shareId')?.trim();
    const clauses = [eq(learnerResults.trainerId,user.id)];
    if (activityId) clauses.push(eq(learnerResults.activityId,activityId));
    if (trainingId) clauses.push(eq(learnerResults.trainingId,trainingId));
    if (mainFolderId) clauses.push(eq(courseFolders.mainFolderId,mainFolderId));
    if (shareId) clauses.push(eq(learnerResults.shareId,shareId));
    if (search) clauses.push(or(like(learnerResults.learnerFirstName,`%${search}%`),like(learnerResults.learnerLastName,`%${search}%`))!);
    const rows = await getDb().select({
      id:learnerResults.id,
      activityId:learnerResults.activityId,
      activityTitle:activities.title,
      activityType:activities.type,
      activityContentJson:activities.contentJson,
      activityCorrection:activities.correction,
      trainingId:learnerResults.trainingId,
      trainingTitle:courseFolders.name,
      mainFolderId:courseFolders.mainFolderId,
      mainFolderTitle:mainFolders.name,
      shareId:learnerResults.shareId,
      participantId:learnerResults.participantId,
      sessionShortCode:trainingShares.shortCode,
      sessionMode:trainingShares.mode,
      learnerFirstName:learnerResults.learnerFirstName,
      learnerLastName:learnerResults.learnerLastName,
      score:learnerResults.score,
      maxScore:learnerResults.maxScore,
      percentage:learnerResults.percentage,
      durationSeconds:learnerResults.durationSeconds,
      attempt:learnerResults.attempt,
      createdAt:learnerResults.createdAt,
      answersJson:learnerResults.answersJson,
    }).from(learnerResults)
      .innerJoin(activities,eq(learnerResults.activityId,activities.id))
      .leftJoin(courseFolders,eq(learnerResults.trainingId,courseFolders.id))
      .leftJoin(mainFolders,eq(courseFolders.mainFolderId,mainFolders.id))
      .leftJoin(trainingShares,eq(learnerResults.shareId,trainingShares.id))
      .where(and(...clauses))
      .orderBy(desc(learnerResults.createdAt));
    const sessions = await getDb().select({id:trainingShares.id,trainingId:trainingShares.trainingId,shortCode:trainingShares.shortCode,mode:trainingShares.mode,status:trainingShares.status,createdAt:trainingShares.createdAt})
      .from(trainingShares).where(eq(trainingShares.trainerId,user.id)).orderBy(desc(trainingShares.createdAt));
    return jsonOk({results:rows.map((row)=>{const answers=parseJson(row.answersJson,[]);return {...row,activityContentJson:undefined,activityCorrection:undefined,answers,correctionDetails:buildResultCorrection(row.activityType as ActivityType,parseJson(row.activityContentJson,{}),answers,row.activityCorrection)};}),sessions});
  } catch(error) { return jsonError(error); }
}

function parseJson<T>(value:string,fallback:T):T { try{return JSON.parse(value) as T;}catch{return fallback;} }

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const activityId = String(body.activityId ?? '').trim();
    const activity = (await getDb().select().from(activities).where(and(eq(activities.id,activityId),eq(activities.status,'published'))).limit(1))[0];
    if (!activity) throw new AppError(404,'Cette activité n’est plus disponible.','ACTIVITY_UNAVAILABLE');

    const trainingId = String(body.trainingId ?? '').trim() || null;
    const pathId = String(body.pathId ?? '').trim() || null;
    if (Boolean(trainingId) !== Boolean(pathId)) throw new AppError(400,'Le contexte du parcours est incomplet.','INCOMPLETE_PATH_CONTEXT');
    if (trainingId && pathId) {
      const membership = (await getDb().select({activityId:learningPathItems.activityId}).from(learningPaths)
        .innerJoin(courseFolders,eq(learningPaths.trainingId,courseFolders.id))
        .innerJoin(learningPathItems,eq(learningPathItems.pathId,learningPaths.id))
        .where(and(eq(learningPaths.id,pathId),eq(learningPaths.trainingId,trainingId),eq(courseFolders.trainerId,activity.trainerId),eq(learningPathItems.activityId,activityId))).limit(1))[0];
      if (!membership) throw new AppError(400,'Cette activité ne fait pas partie du parcours indiqué.','FOREIGN_RESULT_PATH');
    }

    const firstName = String(body.firstName ?? '').replace(/\s+/g,' ').trim().slice(0,80);
    const lastName = String(body.lastName ?? '').replace(/\s+/g,' ').trim().slice(0,80);
    if (!firstName || !lastName) throw new AppError(400,'Renseignez le prénom et le nom de l’apprenant.','LEARNER_NAME_REQUIRED');
    const score = Number(body.score); const maxScore = Number(body.maxScore);
    if (!Number.isInteger(score) || !Number.isInteger(maxScore) || score < 0 || maxScore < 1 || score > maxScore) throw new AppError(400,'Le résultat transmis est invalide.','INVALID_SCORE');
    const id = crypto.randomUUID();
    await getDb().insert(learnerResults).values({
      id,activityId,trainerId:activity.trainerId,trainingId,pathId,learnerFirstName:firstName,learnerLastName:lastName,
      answersJson:JSON.stringify(Array.isArray(body.answers)?body.answers:[]),score,maxScore,percentage:Math.round(score/maxScore*100),
      durationSeconds:Math.max(0,Math.round(Number(body.durationSeconds)||0)),attempt:Math.max(1,Math.round(Number(body.attempt)||1)),
      selfEvaluation:String(body.selfEvaluation??'').slice(0,100)||null,
    });
    return jsonOk({id,message:trainingId?'Votre résultat et votre progression dans la formation ont été enregistrés.':'Votre résultat a été enregistré.'},201);
  } catch(error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request); const user=await requirePermission('viewResults'); const id=new URL(request.url).searchParams.get('id')??'';
    const result=await getDb().delete(learnerResults).where(and(eq(learnerResults.id,id),eq(learnerResults.trainerId,user.id))).returning({id:learnerResults.id});
    if (!result.length) throw new AppError(404,'Ce résultat est introuvable.','RESULT_NOT_FOUND');
    await audit(user.id,'result.deleted','learner_result',id,{},request); return jsonOk({message:'Le résultat a été supprimé.'});
  } catch(error) { return jsonError(error); }
}
