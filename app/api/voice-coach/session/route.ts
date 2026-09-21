import { env } from '@/lib/runtime-env';
import { and,eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities,courseFolders,learnerAssignments,learningPathItems,learningPaths,users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { AppError,assertSameOrigin,jsonError,jsonOk } from '@/lib/http';
import { sha256 } from '@/lib/security';
import { readAiJson, resolveOpenAiCredential } from '@/lib/ai-security';
import { createVoiceCoachClientSecret, VOICE_REALTIME_MODEL } from '@/lib/voice-coach-server';
import { preflightAiUsage,recordAiUsage } from '@/lib/subscriptions-server';
import { finalizeVoiceUsage } from '@/lib/voice-usage-server';

async function voiceAccess(user:Awaited<ReturnType<typeof requireUser>>,activityId:string,assignmentId:string){
  if(user.role!=='learner'){
    const activity=(await getDb().select().from(activities).where(and(eq(activities.id,activityId),eq(activities.trainerId,user.id),eq(activities.type,'voice-coach'))).limit(1))[0];
    if(!activity)throw new AppError(404,'Cette séance vocale est introuvable.','VOICE_COACH_NOT_FOUND');
    return{activity,billingUserId:user.id,billingRole:user.role,maximumSeconds:null,assignmentId:null};
  }
  if(!assignmentId)throw new AppError(400,'Le parcours vocal doit être identifié.','VOICE_ASSIGNMENT_REQUIRED');
  const row=(await getDb().select({activity:activities,assignment:learnerAssignments}).from(learnerAssignments)
    .innerJoin(courseFolders,eq(courseFolders.id,learnerAssignments.trainingId))
    .innerJoin(learningPaths,eq(learningPaths.trainingId,learnerAssignments.trainingId))
    .innerJoin(learningPathItems,eq(learningPathItems.pathId,learningPaths.id))
    .innerJoin(activities,eq(activities.id,learningPathItems.activityId))
    .where(and(eq(learnerAssignments.id,assignmentId),eq(learnerAssignments.learnerId,user.id),eq(learnerAssignments.status,'active'),eq(learnerAssignments.voiceAllowed,true),eq(courseFolders.status,'published'),eq(learningPaths.status,'published'),eq(learningPathItems.activityId,activityId),eq(activities.type,'voice-coach'))).limit(1))[0];
  if(!row)throw new AppError(403,'Cette activité vocale ne vous est pas attribuée ou n’est pas autorisée.','VOICE_COACH_NOT_ASSIGNED');
  const now=Math.floor(Date.now()/1000);
  if(row.assignment.startsAt&&row.assignment.startsAt>now)throw new AppError(403,'Cette activité vocale n’est pas encore ouverte.','VOICE_COACH_NOT_STARTED');
  if(row.assignment.dueAt&&row.assignment.dueAt<now)throw new AppError(403,'La date limite de cette activité vocale est dépassée.','VOICE_COACH_EXPIRED');
  const owner=(await getDb().select({role:users.role}).from(users).where(eq(users.id,row.assignment.trainerId)).limit(1))[0];
  if(!owner||owner.role==='learner')throw new AppError(503,'La connexion IA du formateur est indisponible.','VOICE_OWNER_UNAVAILABLE');
  return{activity:row.activity,billingUserId:row.assignment.trainerId,billingRole:owner.role,maximumSeconds:row.assignment.voiceDurationSeconds,assignmentId:row.assignment.id};
}

export async function POST(request:Request){try{assertSameOrigin(request);const user=await requireUser();const body=await readAiJson(request);const activityId=String(body.activityId??'').trim();const assignmentId=String(body.assignmentId??'').trim();const access=await voiceAccess(user,activityId,assignmentId);await preflightAiUsage(access.billingUserId,access.billingRole,'voiceCoach',{voice:true,minimumCredits:2});const credential=await resolveOpenAiCredential(access.billingUserId);const safety=await sha256(`voice-user:${user.id}:${env.SECURITY_PEPPER}`);const secret=await createVoiceCoachClientSecret(credential.apiKey,JSON.parse(access.activity.contentJson),safety,body.transcriptConsent===true);const usageSessionId=crypto.randomUUID();await recordAiUsage({userId:access.billingUserId,feature:'voice_session_started',model:VOICE_REALTIME_MODEL,requestId:`voice-start:${usageSessionId}`,status:'started',metadata:{activityId,assignmentId:access.assignmentId,learnerId:user.role==='learner'?user.id:null,credentialSource:credential.source}});return jsonOk({...secret,usageSessionId,maxDurationSeconds:access.maximumSeconds});}catch(error){return jsonError(error);}}

export async function PATCH(request:Request){try{assertSameOrigin(request);const user=await requireUser();const body=await readAiJson(request);const activityId=String(body.activityId??'').trim();const assignmentId=String(body.assignmentId??'').trim();const access=await voiceAccess(user,activityId,assignmentId);const usage=await finalizeVoiceUsage({userId:access.billingUserId,activityId,activityContent:JSON.parse(access.activity.contentJson),usageSessionId:body.usageSessionId,durationSeconds:body.durationSeconds,assignmentId:access.assignmentId??undefined,maximumSeconds:access.maximumSeconds??undefined});return jsonOk({...usage,message:usage.recorded?'La consommation vocale a été mise à jour.':'Cette consommation vocale était déjà enregistrée.'});}catch(error){return jsonError(error);}}
