import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { learnerParticipants, trainingShares } from '@/db/schema';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { currentParticipant, learnerCookieName, participantDisplayName, publicShare } from '@/lib/training-sharing';
import { randomToken, sha256 } from '@/lib/security';

export async function POST(request:Request,context:{params:Promise<{token:string}>}){
  try{
    assertSameOrigin(request);const share=await publicShare(decodeURIComponent((await context.params).token));const body=await readJson(request);const now=Math.floor(Date.now()/1000);let participant=await currentParticipant(share);let resumeCode='';let browserToken='';
    if(!participant&&body.resumeCode){const resumeHash=await sha256(`${String(body.resumeCode).replace(/[^A-Za-z0-9]/g,'').toUpperCase()}${env.SECURITY_PEPPER}`);participant=(await getDb().select().from(learnerParticipants).where(and(eq(learnerParticipants.shareId,share.id),eq(learnerParticipants.resumeCodeHash,resumeHash))).limit(1))[0]??null;if(!participant)throw new AppError(404,'Ce code de reprise n’est pas reconnu.','RESUME_CODE_NOT_FOUND');browserToken=randomToken(32);await getDb().update(learnerParticipants).set({browserTokenHash:await sha256(`${browserToken}${env.SECURITY_PEPPER}`),lastSeenAt:now}).where(eq(learnerParticipants.id,participant.id));}
    if(!participant){if(share.maxAccesses&&share.accessCount>=share.maxAccesses)throw new AppError(403,'Le nombre maximal de participants est atteint.','SHARE_ACCESS_LIMIT');const displayName=participantDisplayName(share.identityMode,body);browserToken=randomToken(32);resumeCode=randomToken(10).replace(/[^A-Za-z0-9]/g,'').slice(0,8).toUpperCase();if(resumeCode.length<6)resumeCode=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();participant={id:crypto.randomUUID(),shareId:share.id,browserTokenHash:await sha256(`${browserToken}${env.SECURITY_PEPPER}`),resumeCodeHash:await sha256(`${resumeCode}${env.SECURITY_PEPPER}`),displayName,identityKind:share.identityMode,lastPathItemId:null,progressPercent:0,startedAt:now,lastSeenAt:now,completedAt:null};await getDb().batch([getDb().insert(learnerParticipants).values(participant),getDb().update(trainingShares).set({accessCount:share.accessCount+1,updatedAt:now}).where(eq(trainingShares.id,share.id))]);}
    const response=jsonOk({participant:{id:participant.id,displayName:participant.displayName,progressPercent:participant.progressPercent,lastPathItemId:participant.lastPathItemId},resumeCode:resumeCode||null,message:resumeCode?'Votre parcours est prêt. Notez votre code de reprise.':'Votre parcours a été retrouvé.'});if(browserToken)response.cookies.set(learnerCookieName(share.shortCode),browserToken,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:`/`,maxAge:share.expiresAt?Math.max(300,share.expiresAt-now):60*60*24*60});return response;
  }catch(error){return jsonError(error);}
}
