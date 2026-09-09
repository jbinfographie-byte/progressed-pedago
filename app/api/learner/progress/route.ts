import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, learnerAccountProgress, learnerAssignments, learnerEvaluations, learnerNotifications, learnerResults, learningPathItems, learningPaths } from '@/db/schema';
import { audit, requireLearner } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { cleanText, getActiveAssignment } from '@/lib/learner-access';

export async function PATCH(request:Request){
  try{
    assertSameOrigin(request);const learner=await requireLearner();const body=await readJson(request);const assignmentId=cleanText(body.assignmentId,100);const activityId=cleanText(body.activityId,100);
    const assignment=(await getDb().select().from(learnerAssignments).where(and(eq(learnerAssignments.id,assignmentId),eq(learnerAssignments.learnerId,learner.id))).limit(1))[0];
    if(!assignment)throw new AppError(404,'Ce parcours est introuvable.','ASSIGNMENT_NOT_FOUND');
    await getActiveAssignment(learner.id,assignment.trainingId);
    const target=(await getDb().select({item:learningPathItems,activity:activities}).from(learningPaths).innerJoin(learningPathItems,eq(learningPathItems.pathId,learningPaths.id)).innerJoin(activities,eq(activities.id,learningPathItems.activityId)).where(and(eq(learningPaths.trainingId,assignment.trainingId),eq(learningPathItems.activityId,activityId),eq(activities.status,'published'))).limit(1))[0];
    if(!target)throw new AppError(404,'Cette activité ne fait pas partie de votre parcours.','ACTIVITY_NOT_ASSIGNED');
    if(target.activity.type==='voice-coach'&&!assignment.voiceAllowed)throw new AppError(403,'Le Coach vocal n’est pas autorisé pour ce parcours.','VOICE_DISABLED');
    if(assignment.orderMode==='sequential'&&target.item.position>0){
      const previous=await getDb().select({activityId:learningPathItems.activityId,minScore:learningPathItems.minScore}).from(learningPathItems).where(and(eq(learningPathItems.pathId,target.item.pathId),lt(learningPathItems.position,target.item.position)));
      for(const item of previous){const progress=(await getDb().select().from(learnerAccountProgress).where(and(eq(learnerAccountProgress.assignmentId,assignmentId),eq(learnerAccountProgress.activityId,item.activityId))).limit(1))[0];const progressPercentage=progress?.score!=null&&progress.maxScore?Math.round(progress.score/progress.maxScore*100):null;if(!progress||!['completed','validated'].includes(progress.status)||(item.minScore>0&&(progressPercentage??0)<item.minScore))throw new AppError(403,'Terminez d’abord les activités précédentes et atteignez la note minimale demandée.','ACTIVITY_LOCKED');}
    }
    const existing=(await getDb().select().from(learnerAccountProgress).where(and(eq(learnerAccountProgress.assignmentId,assignmentId),eq(learnerAccountProgress.activityId,activityId))).limit(1))[0];
    const requested=String(body.status??'in_progress');const completing=requested==='completed';const attempts=existing?.attempts??0;
    if(completing&&attempts>=assignment.maxAttempts)throw new AppError(403,'Le nombre maximal de tentatives est atteint. Contactez votre formateur.','ATTEMPTS_EXHAUSTED');
    const now=Math.floor(Date.now()/1000);const rawScore=body.score==null?null:Number(body.score);const rawMaxScore=body.maxScore==null?null:Number(body.maxScore);if((rawScore!=null&&!Number.isFinite(rawScore))||(rawMaxScore!=null&&!Number.isFinite(rawMaxScore)))throw new AppError(400,'Le résultat transmis est invalide.','INVALID_SCORE');const score=rawScore==null?null:Math.max(0,Math.round(rawScore));const maxScore=rawMaxScore==null?null:Math.max(1,Math.round(rawMaxScore));if(score!=null&&maxScore!=null&&score>maxScore)throw new AppError(400,'La note ne peut pas dépasser le barème.','INVALID_SCORE');const percentage=score!=null&&maxScore?Math.min(100,Math.round(score/maxScore*100)):null;
    const status=completing?(assignment.manualValidation?'submitted':'completed'):'in_progress';const values={learnerId:learner.id,status:status as 'in_progress'|'submitted'|'completed',score,maxScore,attempts:attempts+(completing?1:0),durationSeconds:Math.max(existing?.durationSeconds??0,Math.round(Number(body.durationSeconds)||0)),answersJson:JSON.stringify(Array.isArray(body.answers)?body.answers:[]),startedAt:existing?.startedAt??now,completedAt:completing?now:null,updatedAt:now};
    if(existing)await getDb().update(learnerAccountProgress).set(values).where(eq(learnerAccountProgress.id,existing.id));else await getDb().insert(learnerAccountProgress).values({id:crypto.randomUUID(),assignmentId,activityId,...values});
    if(completing&&score!=null&&maxScore){await getDb().insert(learnerResults).values({id:crypto.randomUUID(),activityId,trainerId:assignment.trainerId,trainingId:assignment.trainingId,pathId:target.item.pathId,learnerFirstName:learner.firstName??'Apprenant',learnerLastName:learner.lastName??'',answersJson:values.answersJson,score,maxScore,percentage:percentage??0,durationSeconds:values.durationSeconds,attempt:values.attempts});}
    if(completing&&assignment.manualValidation){const evaluationId=crypto.randomUUID();await getDb().batch([getDb().insert(learnerEvaluations).values({id:evaluationId,assignmentId,learnerId:learner.id,activityId,trainerId:assignment.trainerId,status:'submitted',score,maxScore,attempt:values.attempts}),getDb().insert(learnerNotifications).values({id:crypto.randomUUID(),userId:assignment.trainerId,kind:'submission',title:'Activité à valider',body:`${learner.displayName??learner.email} a terminé « ${target.activity.title} ».`,link:'/?view=learners'})]);}
    await audit(learner.id,'learner.progress_updated','activity',activityId,{assignmentId,status,score,maxScore},request);return jsonOk({status,score,maxScore,percentage,message:status==='submitted'?'Activité remise au formateur.':'Progression enregistrée.'});
  }catch(error){return jsonError(error);}
}
