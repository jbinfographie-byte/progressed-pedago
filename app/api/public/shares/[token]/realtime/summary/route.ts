import { env } from 'cloudflare:workers';
import { and,eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities,encryptedApiCredentials,learningPathItems,users } from '@/db/schema';
import { AppError,assertSameOrigin,jsonError,jsonOk,readJson } from '@/lib/http';
import { decryptSecret } from '@/lib/security';
import { currentParticipant,publicShare } from '@/lib/training-sharing';
import { normalizeVoiceCoachContent } from '@/lib/voice-coach';
import { preflightAiUsage,recordAiUsage } from '@/lib/subscriptions-server';

const stringArray={type:'array',maxItems:8,items:{type:'string'}};
const reportSchema={type:'object',additionalProperties:false,required:['score','maxScore','summary','objectivesMet','successes','reviewItems','masteredVocabulary','corrections','listeningQuality','instructionClarity','managementPosture','betterResponse','tip','nextExercise','attempts'],properties:{score:{type:'integer',minimum:0,maximum:5},maxScore:{type:'integer',enum:[5]},summary:{type:'string'},objectivesMet:stringArray,successes:stringArray,reviewItems:stringArray,masteredVocabulary:stringArray,corrections:stringArray,listeningQuality:{type:'string'},instructionClarity:{type:'string'},managementPosture:{type:'string'},betterResponse:{type:'string'},tip:{type:'string'},nextExercise:{type:'string'},attempts:{type:'integer',minimum:0,maximum:100}}};

export async function POST(request:Request,context:{params:Promise<{token:string}>}){
  try{
    assertSameOrigin(request);const share=await publicShare(decodeURIComponent((await context.params).token));const participant=await currentParticipant(share);
    if(!participant)throw new AppError(401,'Commencez ou reprenez d’abord votre parcours.','PARTICIPANT_REQUIRED');
    const body=await readJson(request);if(body.transcriptConsent!==true)throw new AppError(400,'Le bilan détaillé nécessite votre accord pour analyser temporairement la transcription.','TRANSCRIPT_CONSENT_REQUIRED');
    const pathItemId=String(body.pathItemId??'').trim();const item=(await getDb().select({activityId:activities.id,contentJson:activities.contentJson}).from(learningPathItems).innerJoin(activities,eq(learningPathItems.activityId,activities.id)).where(and(eq(learningPathItems.id,pathItemId),eq(learningPathItems.pathId,share.pathId),eq(activities.type,'voice-coach'))).limit(1))[0];
    if(!item)throw new AppError(404,'Cette séance vocale est introuvable.','VOICE_COACH_NOT_FOUND');
    const transcript=Array.isArray(body.transcript)?body.transcript.filter((line):line is Record<string,unknown>=>Boolean(line&&typeof line==='object')).slice(-80).map((line)=>`${line.role==='learner'?'Apprenant':'Coach'} : ${String(line.text??'').slice(0,1_000)}`).join('\n').slice(0,30_000):'';
    if(transcript.length<20)throw new AppError(422,'La transcription est trop courte pour établir un bilan détaillé fiable.','VOICE_TRANSCRIPT_TOO_SHORT');
    const owner=(await getDb().select({role:users.role}).from(users).where(eq(users.id,share.trainerId)).limit(1))[0];
    if(!owner)throw new AppError(404,'Le compte formateur est introuvable.','TRAINER_NOT_FOUND');
    await preflightAiUsage(share.trainerId,owner.role,'personalizedCorrections',{minimumCredits:1});
    const credential=(await getDb().select().from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId,share.trainerId)).limit(1))[0];
    if(!credential)throw new AppError(409,'Le formateur doit reconnecter sa clé OpenAI.','OPENAI_NOT_CONNECTED');
    const apiKey=await decryptSecret(credential.ciphertext,credential.iv,env.MASTER_ENCRYPTION_KEY);const config=normalizeVoiceCoachContent(JSON.parse(item.contentJson));
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:credential.model,store:false,instructions:'Tu évalues avec bienveillance une séance orale de langue ou de formation professionnelle. Appuie-toi exclusivement sur la transcription fournie. N’invente aucune réussite ni erreur absente du texte. Ne pénalise jamais un accent si le message est intelligible. Évalue l’atteinte des objectifs, l’écoute, la clarté, le vocabulaire et, seulement si le scénario le permet, la posture professionnelle ou managériale. Propose une meilleure réponse concrète et un exercice suivant.',input:`Activités : ${config.activityKinds.join(', ')}\nLangue ou domaine : ${config.learningLanguage}\nNiveau : ${config.cefrLevel}\nThème professionnel : ${config.professionalTheme}\nSujet : ${config.topic}\nRôle IA : ${config.aiRole}\nRôle apprenant : ${config.learnerRole}\nMission : ${config.mission}\nObjectifs : ${config.objectives.join(' ; ')}\nCompétences : ${config.skills.join(' ; ')}\nVocabulaire : ${config.vocabulary.join(' ; ')}\nCritères : ${config.evaluationCriteria.join(' ; ')}\nTentatives observées : ${Math.max(0,Number(body.attempts)||0)}\n\nTranscription temporaire :\n${transcript}`,text:{format:{type:'json_schema',name:'voice_coach_report',strict:true,schema:reportSchema}},max_output_tokens:3_000}),signal:AbortSignal.timeout(30_000)});
    const payload=await response.json() as {id?:string;output?:unknown[];usage?:{input_tokens?:number;output_tokens?:number};error?:{message?:string}};
    if(!response.ok)throw new AppError(response.status>=500?503:502,payload.error?.message?.slice(0,240)||'Le bilan vocal n’a pas pu être préparé.','VOICE_SUMMARY_ERROR');
    const output=findOutputText(payload.output);if(!output)throw new AppError(502,'Le bilan vocal reçu est vide.','VOICE_SUMMARY_EMPTY');
    const report=JSON.parse(output) as Record<string,unknown>;
    await recordAiUsage({userId:share.trainerId,feature:'personalized_voice_correction',model:credential.model,inputTokens:payload.usage?.input_tokens,outputTokens:payload.usage?.output_tokens,creditsCharged:1,requestId:payload.id,status:'completed',metadata:{activityId:item.activityId,participantId:participant.id}});
    return jsonOk({report:{kind:'voice-coach-report',...report,transcriptStored:false}});
  }catch(error){return jsonError(error);}
}

function findOutputText(output:unknown):string{if(!Array.isArray(output))return'';for(const item of output){if(!item||typeof item!=='object')continue;const content=(item as {content?:unknown}).content;if(Array.isArray(content))for(const part of content)if(part&&typeof part==='object'&&(part as {type?:string}).type==='output_text')return String((part as {text?:unknown}).text??'');}return'';}
