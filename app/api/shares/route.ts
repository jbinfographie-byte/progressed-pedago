import { env } from '@/lib/runtime-env';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolders, learnerParticipants, learningPaths, trainingShares } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { assertLiveActivityInPath, normalizeShareSettings, sharePublicUrl, uniqueShareShortCode } from '@/lib/training-sharing';
import { encryptSecret, randomToken, sha256 } from '@/lib/security';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('publishActivities'); const params = new URL(request.url).searchParams; const trainingId = params.get('trainingId')?.trim();
    const clauses = [eq(trainingShares.trainerId,user.id)]; if(trainingId) clauses.push(eq(trainingShares.trainingId,trainingId));
    const rows = await getDb().select().from(trainingShares).where(and(...clauses)).orderBy(desc(trainingShares.updatedAt));
    const participants = rows.length ? await getDb().select({shareId:learnerParticipants.shareId,total:count()}).from(learnerParticipants).where(inArray(learnerParticipants.shareId, rows.map((row)=>row.id))).groupBy(learnerParticipants.shareId) : [];
    return jsonOk({ shares:await Promise.all(rows.map(async(share)=>({...share,url:await sharePublicUrl(share,new URL(request.url).origin),participantCount:participants.find((item)=>item.shareId===share.id)?.total??0,tokenCiphertext:undefined,tokenIv:undefined,tokenHash:undefined}))) });
  } catch(error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user=await requirePermission('publishActivities'); const body=await readJson(request); const trainingId=String(body.trainingId??'').trim();
    const training=(await getDb().select().from(courseFolders).where(and(eq(courseFolders.id,trainingId),eq(courseFolders.trainerId,user.id))).limit(1))[0];
    if(!training) throw new AppError(404,'Cette formation est introuvable.','TRAINING_NOT_FOUND');
    if(training.status!=='published') throw new AppError(409,'Publiez d’abord la formation avant de créer un accès apprenant.','TRAINING_NOT_PUBLISHED');
    const path=(await getDb().select().from(learningPaths).where(and(eq(learningPaths.trainingId,trainingId),eq(learningPaths.trainerId,user.id))).limit(1))[0];
    if(!path||path.status!=='published') throw new AppError(409,'Le parcours doit être publié avant son partage.','PATH_NOT_PUBLISHED');
    const settings=normalizeShareSettings(body);if(settings.mode==='classroom')await assertLiveActivityInPath(path.id,settings.liveActivityId);const token=randomToken(32); const encrypted=await encryptSecret(token,env.MASTER_ENCRYPTION_KEY); const now=Math.floor(Date.now()/1000);
    const shortCode=await uniqueShareShortCode();
    const id=crypto.randomUUID(); await getDb().insert(trainingShares).values({id,trainerId:user.id,trainingId,pathId:path.id,tokenHash:await sha256(`${token}${env.SECURITY_PEPPER}`),tokenCiphertext:encrypted.ciphertext,tokenIv:encrypted.iv,shortCode,...settings,status:'active',accessCount:0,createdAt:now,updatedAt:now});
    await audit(user.id,'training.share.created','training_share',id,{trainingId,mode:settings.mode},request); const share=await getDb().select().from(trainingShares).where(eq(trainingShares.id,id)).limit(1);
    return jsonOk({share:{...share[0],url:await sharePublicUrl(share[0],new URL(request.url).origin),participantCount:0,tokenCiphertext:undefined,tokenIv:undefined,tokenHash:undefined},message:'Le lien sécurisé et le QR code sont prêts.'},201);
  } catch(error) { return jsonError(error); }
}
