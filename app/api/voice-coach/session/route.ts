import { env } from 'cloudflare:workers';
import { and,eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { AppError,assertSameOrigin,jsonError,jsonOk } from '@/lib/http';
import { sha256 } from '@/lib/security';
import { readAiJson, resolveOpenAiCredential } from '@/lib/ai-security';
import { createVoiceCoachClientSecret, VOICE_REALTIME_MODEL } from '@/lib/voice-coach-server';
import { preflightAiUsage,recordAiUsage } from '@/lib/subscriptions-server';

export async function POST(request:Request){try{assertSameOrigin(request);const user=await requireUser();await preflightAiUsage(user.id,user.role,'voiceCoach',{voice:true,minimumCredits:2});const body=await readAiJson(request);const activityId=String(body.activityId??'').trim();const activity=(await getDb().select().from(activities).where(and(eq(activities.id,activityId),eq(activities.trainerId,user.id),eq(activities.type,'voice-coach'))).limit(1))[0];if(!activity)throw new AppError(404,'Cette séance vocale est introuvable.','VOICE_COACH_NOT_FOUND');const credential=await resolveOpenAiCredential(user.id);const safety=await sha256(`trainer:${user.id}:${env.SECURITY_PEPPER}`);const secret=await createVoiceCoachClientSecret(credential.apiKey,JSON.parse(activity.contentJson),safety,body.transcriptConsent===true);await recordAiUsage({userId:user.id,feature:'voice_session_started',model:VOICE_REALTIME_MODEL,requestId:`voice-start:${user.id}:${activityId}:${Date.now()}`,status:'started',metadata:{credentialSource:credential.source}});return jsonOk(secret);}catch(error){return jsonError(error);}}
