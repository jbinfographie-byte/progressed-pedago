import { AppError } from './http.ts';
import { normalizeVoiceCoachContent, voiceCoachInstructions } from './voice-coach.ts';

export async function createVoiceCoachClientSecret(apiKey:string,content:unknown,safetyIdentifier:string,transcribe:boolean) {
  const config=normalizeVoiceCoachContent(content);
  const response=await fetch('https://api.openai.com/v1/realtime/client_secrets',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','OpenAI-Safety-Identifier':safetyIdentifier},body:JSON.stringify({session:{type:'realtime',model:'gpt-realtime-2.1',instructions:voiceCoachInstructions(config),output_modalities:['audio'],audio:{input:{...(transcribe?{transcription:{model:'gpt-4o-mini-transcribe'}}:{}),turn_detection:{type:'semantic_vad',create_response:true,interrupt_response:true}},output:{voice:config.voice}}}}),signal:AbortSignal.timeout(20_000)});
  const payload=await response.json() as {value?:string;expires_at?:number;client_secret?:{value?:string;expires_at?:number};error?:{code?:string;message?:string}};
  if(!response.ok)throw voiceCoachOpenAIError(response.status,payload.error?.code,payload.error?.message);
  const value=payload.value??payload.client_secret?.value;if(!value)throw new AppError(502,'OpenAI n’a pas fourni de clé de session vocale. Réessayez.','REALTIME_SECRET_EMPTY');
  return {value,expiresAt:payload.expires_at??payload.client_secret?.expires_at??null,config:{maxDurationMinutes:config.maxDurationMinutes,showText:config.showText,allowTranslation:config.allowTranslation,transcriptMode:config.transcriptMode,learningLanguage:config.learningLanguage,explanationLanguage:config.explanationLanguage}};
}

export function voiceCoachOpenAIError(status:number,code?:string,message?:string) { if(status===401)return new AppError(400,'La clé OpenAI du formateur n’est plus valide.','OPENAI_INVALID_KEY');if(status===429||code?.includes('quota'))return new AppError(429,'Le quota OpenAI est dépassé ou la facturation est inactive.','OPENAI_QUOTA');if(status===403)return new AppError(403,'Le modèle vocal en temps réel n’est pas accessible avec cette clé OpenAI.','OPENAI_REALTIME_FORBIDDEN');if(status>=500)return new AppError(503,'Le coach vocal est momentanément indisponible. Réessayez dans un instant.','OPENAI_REALTIME_UNAVAILABLE');return new AppError(502,message?.slice(0,240)||'La session vocale n’a pas pu démarrer.','OPENAI_REALTIME_ERROR'); }
