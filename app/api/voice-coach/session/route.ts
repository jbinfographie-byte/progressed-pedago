import { env } from 'cloudflare:workers';
import { and,eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities,encryptedApiCredentials } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { AppError,assertSameOrigin,jsonError,jsonOk,readJson } from '@/lib/http';
import { decryptSecret,sha256 } from '@/lib/security';
import { createVoiceCoachClientSecret } from '@/lib/voice-coach-server';
import { preflightAiUsage,recordAiUsage } from '@/lib/subscriptions-server';

export async function POST(request:Request){try{assertSameOrigin(request);const user=await requirePermission('useAi');await preflightAiUsage(user.id,user.role,'voiceCoach',{voice:true,minimumCredits:2});const body=await readJson(request);const activityId=String(body.activityId??'').trim();const activity=(await getDb().select().from(activities).where(and(eq(activities.id,activityId),eq(activities.trainerId,user.id),eq(activities.type,'voice-coach'))).limit(1))[0];if(!activity)throw new AppError(404,'Cette séance vocale est introuvable.','VOICE_COACH_NOT_FOUND');const credential=(await getDb().select().from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId,user.id)).limit(1))[0];if(!credential)throw new AppError(409,'Connectez d’abord votre clé OpenAI personnelle dans Connexions.','OPENAI_NOT_CONNECTED');const apiKey=await decryptSecret(credential.ciphertext,credential.iv,env.MASTER_ENCRYPTION_KEY);const safety=await sha256(`trainer:${user.id}:${env.SECURITY_PEPPER}`);const secret=await createVoiceCoachClientSecret(apiKey,JSON.parse(activity.contentJson),safety,body.transcriptConsent===true);await recordAiUsage({userId:user.id,feature:'voice_session_started',model:'gpt-realtime-2.1',requestId:`voice-start:${user.id}:${activityId}:${Date.now()}`,status:'started'});return jsonOk(secret);}catch(error){return jsonError(error);}}
