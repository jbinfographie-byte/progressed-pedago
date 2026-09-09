import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, learnerAccountProgress, learnerAssignments, learnerEvaluations, learnerMessages, learnerNotifications, learnerProfiles, learnerSubmissions, learningPathItems, learningPaths, users } from '@/db/schema';
import { audit, requireLearner } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { cleanText } from '@/lib/learner-access';

export async function GET() {
  try {
    const learner = await requireLearner();
    const profile = (await getDb().select({ organization:learnerProfiles.organization, groupName:learnerProfiles.groupName, assignedTrainerId:learnerProfiles.assignedTrainerId, trainerFirstName:users.firstName, trainerLastName:users.lastName, trainerDisplayName:users.displayName })
      .from(learnerProfiles).leftJoin(users, eq(users.id, learnerProfiles.assignedTrainerId)).where(eq(learnerProfiles.userId, learner.id)).limit(1))[0] ?? null;
    const assignments = await getDb().select({
      id:learnerAssignments.id, trainingId:learnerAssignments.trainingId, trainerId:learnerAssignments.trainerId,
      startsAt:learnerAssignments.startsAt, dueAt:learnerAssignments.dueAt, status:learnerAssignments.status,
      orderMode:learnerAssignments.orderMode, maxAttempts:learnerAssignments.maxAttempts, resultVisible:learnerAssignments.resultVisible,
      commentsVisible:learnerAssignments.commentsVisible, uploadAllowed:learnerAssignments.uploadAllowed,
      chatAllowed:learnerAssignments.chatAllowed, voiceAllowed:learnerAssignments.voiceAllowed,
      voiceDurationSeconds:learnerAssignments.voiceDurationSeconds, manualValidation:learnerAssignments.manualValidation,
      trainingName:courseFolders.name, trainingDescription:courseFolders.description, coverImageUrl:courseFolders.coverImageUrl,
      pathId:learningPaths.id, pathName:learningPaths.name,
    }).from(learnerAssignments).innerJoin(courseFolders,eq(courseFolders.id,learnerAssignments.trainingId)).leftJoin(learningPaths,eq(learningPaths.trainingId,courseFolders.id))
      .where(and(eq(learnerAssignments.learnerId,learner.id),ne(learnerAssignments.status,'removed'))).orderBy(desc(learnerAssignments.updatedAt));
    const pathIds=assignments.map((item)=>item.pathId).filter((id):id is string=>Boolean(id));
    const items=pathIds.length?await getDb().select({
      id:learningPathItems.id,pathId:learningPathItems.pathId,activityId:learningPathItems.activityId,position:learningPathItems.position,
      required:learningPathItems.required,minScore:learningPathItems.minScore,unlockAfterPrevious:learningPathItems.unlockAfterPrevious,
      type:activities.type,title:activities.title,theme:activities.theme,audience:activities.audience,level:activities.level,
      objectivesJson:activities.objectivesJson,durationMinutes:activities.durationMinutes,instructions:activities.instructions,
      contentJson:activities.contentJson,explanation:activities.explanation,correction:activities.correction,sourcesJson:activities.sourcesJson,
      activityStatus:activities.status,qualityScore:activities.qualityScore,updatedAt:activities.updatedAt,
    }).from(learningPathItems).innerJoin(activities,eq(activities.id,learningPathItems.activityId)).where(inArray(learningPathItems.pathId,pathIds)).orderBy(asc(learningPathItems.position)):[];
    const progress=await getDb().select().from(learnerAccountProgress).where(eq(learnerAccountProgress.learnerId,learner.id));
    const evaluations=await getDb().select().from(learnerEvaluations).where(eq(learnerEvaluations.learnerId,learner.id)).orderBy(desc(learnerEvaluations.updatedAt));
    const submissions=await getDb().select().from(learnerSubmissions).where(eq(learnerSubmissions.learnerId,learner.id)).orderBy(desc(learnerSubmissions.createdAt));
    const messages=await getDb().select().from(learnerMessages).where(eq(learnerMessages.learnerId,learner.id)).orderBy(asc(learnerMessages.createdAt));
    const notifications=await getDb().select().from(learnerNotifications).where(eq(learnerNotifications.userId,learner.id)).orderBy(desc(learnerNotifications.createdAt)).limit(50);
    const progressByAssignmentActivity=new Map(progress.map((row)=>[`${row.assignmentId}:${row.activityId}`,row]));
    const assignmentById=new Map(assignments.map((assignment)=>[assignment.id,assignment]));
    const safeAssignments=assignments.map((assignment)=>({...assignment,items:items.filter((item)=>item.pathId===assignment.pathId).map((item)=>{
      const activityProgress=progressByAssignmentActivity.get(`${assignment.id}:${item.activityId}`);
      const revealCorrection=assignment.resultVisible&&['completed','validated'].includes(activityProgress?.status??'');
      return{...item,correction:revealCorrection?item.correction:'',objectives:JSON.parse(item.objectivesJson),content:JSON.parse(item.contentJson),sources:[]};
    })}));
    const safeEvaluations=evaluations.map((evaluation)=>{const assignment=assignmentById.get(evaluation.assignmentId);return{id:evaluation.id,assignmentId:evaluation.assignmentId,activityId:evaluation.activityId,status:evaluation.status,score:assignment?.resultVisible?evaluation.score:null,maxScore:assignment?.resultVisible?evaluation.maxScore:null,publicComment:assignment?.commentsVisible?evaluation.publicComment:'',updatedAt:evaluation.updatedAt};});
    const safeSubmissions=submissions.map((submission)=>({id:submission.id,assignmentId:submission.assignmentId,activityId:submission.activityId,originalName:submission.originalName,status:submission.status,trainerComment:assignmentById.get(submission.assignmentId)?.commentsVisible?submission.trainerComment:'',createdAt:submission.createdAt}));
    return jsonOk({ learner:{id:learner.id,email:learner.email,firstName:learner.firstName,lastName:learner.lastName,displayName:learner.displayName}, profile, assignments:safeAssignments, progress, evaluations:safeEvaluations, submissions:safeSubmissions, messages, notifications });
  } catch(error){return jsonError(error);}
}

export async function POST(request:Request){
  try{
    assertSameOrigin(request);const learner=await requireLearner();const body=await readJson(request);const action=String(body.action??'message');
    if(action==='message'){
      const profile=(await getDb().select().from(learnerProfiles).where(eq(learnerProfiles.userId,learner.id)).limit(1))[0];
      if(!profile?.assignedTrainerId)throw new AppError(400,'Aucun formateur référent ne vous est attribué.','TRAINER_REQUIRED');
      const assignment=(await getDb().select().from(learnerAssignments).where(and(eq(learnerAssignments.learnerId,learner.id),eq(learnerAssignments.trainerId,profile.assignedTrainerId),eq(learnerAssignments.chatAllowed,true),ne(learnerAssignments.status,'removed'))).limit(1))[0];
      if(!assignment)throw new AppError(403,'La messagerie n’est pas autorisée pour vos parcours actuels.','CHAT_DISABLED');
      const message=cleanText(body.message,4000);if(!message)throw new AppError(400,'Le message est vide.','EMPTY_MESSAGE');
      await getDb().batch([getDb().insert(learnerMessages).values({id:crypto.randomUUID(),learnerId:learner.id,trainerId:profile.assignedTrainerId,authorId:learner.id,body:message}),getDb().insert(learnerNotifications).values({id:crypto.randomUUID(),userId:profile.assignedTrainerId,kind:'learner_message',title:'Nouveau message apprenant',body:message.slice(0,180),link:'/?view=learners'})]);
      await audit(learner.id,'learner.message_sent','user',profile.assignedTrainerId,{},request);return jsonOk({message:'Message envoyé à votre formateur.'});
    }
    if(action==='read_notifications'){await getDb().update(learnerNotifications).set({readAt:Math.floor(Date.now()/1000)}).where(and(eq(learnerNotifications.userId,learner.id),isNull(learnerNotifications.readAt)));return jsonOk({message:'Notifications lues.'});}
    if(action==='read_messages'){await getDb().update(learnerMessages).set({readAt:Math.floor(Date.now()/1000)}).where(and(eq(learnerMessages.learnerId,learner.id),ne(learnerMessages.authorId,learner.id),isNull(learnerMessages.readAt)));return jsonOk({message:'Messages lus.'});}
    throw new AppError(400,'Action inconnue.','INVALID_ACTION');
  }catch(error){return jsonError(error);}
}
