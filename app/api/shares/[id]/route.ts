import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { trainingShares } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { assertLiveActivityInPath, normalizeShareSettings, ownedShare, sharePublicUrl } from '@/lib/training-sharing';
import { encryptSecret, randomToken, sha256 } from '@/lib/security';

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const user=await requirePermission('publishActivities');const id=(await context.params).id;const share=await ownedShare(id,user.id);const body=await readJson(request);const now=Math.floor(Date.now()/1000);const changes:Partial<typeof trainingShares.$inferInsert>={updatedAt:now};
    if('status'in body)changes.status=body.status==='disabled'?'disabled':'active';if('sessionOpen'in body)changes.sessionOpen=body.sessionOpen===true;
    if('mode'in body||'liveActivityId'in body||'identityMode'in body||'expiresAt'in body||'maxAccesses'in body){const settings=normalizeShareSettings({...share,...body});if(settings.mode==='classroom')await assertLiveActivityInPath(share.pathId,settings.liveActivityId);Object.assign(changes,settings);}
    let renewed=false;if(body.renew===true){const token=randomToken(32);const encrypted=await encryptSecret(token,env.MASTER_ENCRYPTION_KEY);Object.assign(changes,{tokenHash:await sha256(`${token}${env.SECURITY_PEPPER}`),tokenCiphertext:encrypted.ciphertext,tokenIv:encrypted.iv,status:'active' as const});renewed=true;}
    await getDb().update(trainingShares).set(changes).where(eq(trainingShares.id,id));const updated=(await getDb().select().from(trainingShares).where(eq(trainingShares.id,id)).limit(1))[0];await audit(user.id,renewed?'training.share.renewed':'training.share.updated','training_share',id,{},request);return jsonOk({share:{...updated,url:await sharePublicUrl(updated,new URL(request.url).origin),tokenCiphertext:undefined,tokenIv:undefined,tokenHash:undefined},message:renewed?'Le lien a été renouvelé. L’ancien QR code ne fonctionne plus.':'Les réglages de partage sont enregistrés.'});
  }catch(error){return jsonError(error);}
}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const user=await requirePermission('publishActivities');const id=(await context.params).id;await ownedShare(id,user.id);await getDb().update(trainingShares).set({status:'disabled',sessionOpen:false,updatedAt:Math.floor(Date.now()/1000)}).where(eq(trainingShares.id,id));await audit(user.id,'training.share.disabled','training_share',id,{},request);return jsonOk({message:'Le lien est désactivé. Les résultats déjà reçus sont conservés.'});}catch(error){return jsonError(error);}}
