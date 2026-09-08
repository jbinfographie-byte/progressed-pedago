import { env } from 'cloudflare:workers';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { supportAttachments, supportMessages, supportTickets } from '@/db/schema';
import { audit, getCurrentUser } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { sendTransactionalEmail } from '@/lib/notifications';
import { assertPublicSubmissionLimit, cleanSupportEmail, cleanText, SUPPORT_CATEGORIES, supportAdminEmail, uniqueReference } from '@/lib/support';
import { validateSupportAttachment } from '@/lib/support-attachments';

export async function GET() {
  try {
    const user=await getCurrentUser(); if(!user)throw new AppError(401,'Connectez-vous pour suivre vos demandes.','SESSION_REQUIRED');
    const tickets=await getDb().select().from(supportTickets).where(eq(supportTickets.requesterId,user.id)).orderBy(desc(supportTickets.updatedAt)).limit(50);
    return jsonOk({tickets});
  } catch(error){return jsonError(error)}
}

export async function POST(request:Request){
  let objectKey='';
  try{
    assertSameOrigin(request); await assertPublicSubmissionLimit(request,'support');
    const {body,file}=await ticketBody(request); const user=await getCurrentUser(); const category=String(body.category??'technical');
    if(!SUPPORT_CATEGORIES.includes(category as typeof SUPPORT_CATEGORIES[number]))throw new AppError(400,'Choisissez une catégorie valide.','TICKET_CATEGORY_INVALID');
    if(!truthy(body.consent))throw new AppError(400,'Votre accord est nécessaire pour traiter cette demande.','CONSENT_REQUIRED');
    const now=Math.floor(Date.now()/1000); const id=crypto.randomUUID(); const reference=uniqueReference('PP'); const urgency=['normal','important','urgent'].includes(String(body.urgency))?String(body.urgency) as 'normal'|'important'|'urgent':'normal';
    const firstName=cleanText(body.firstName||user?.firstName,80,'Le prénom'); const lastName=cleanText(body.lastName||user?.lastName,80,'Le nom'); const email=cleanSupportEmail(body.email||user?.email); const subject=cleanText(body.subject,180,'L’objet'); const description=cleanText(body.description,8_000,'La description');
    const attachment=file?validateSupportAttachment({bytes:new Uint8Array(await file.arrayBuffer()),declaredType:file.type,originalName:file.name}):null; const attachmentId=attachment?crypto.randomUUID():'';
    if(attachment){objectKey=`support/${id}/${attachmentId}.${attachment.extension}`;await env.FILES.put(objectKey,attachment.bytes,{httpMetadata:{contentType:attachment.mimeType,contentDisposition:`attachment; filename="${attachment.safeName}"`},customMetadata:{ticketId:id,kind:'support-attachment'}})}
    await getDb().insert(supportTickets).values({id,reference,requesterId:user?.id??null,firstName,lastName,email,organization:cleanText(body.organization,160,'L’organisme',false),category,subject,description,urgency,status:urgency==='urgent'?'urgent':'new',priority:urgency==='urgent'?'high':'normal',pageUrl:safePage(body.pageUrl),browserInfo:cleanText(body.browserInfo||request.headers.get('user-agent'),500,'Le navigateur',false),planName:cleanText(body.planName,80,'La formule',false),consentedAt:now,createdAt:now,updatedAt:now});
    try{await getDb().insert(supportMessages).values({id:crypto.randomUUID(),ticketId:id,authorId:user?.id??null,authorRole:'requester',message:description,createdAt:now});if(attachment)await getDb().insert(supportAttachments).values({id:attachmentId,ticketId:id,objectKey,originalName:attachment.safeName,mimeType:attachment.mimeType,sizeBytes:attachment.bytes.length,createdAt:now})}catch(error){await getDb().delete(supportTickets).where(eq(supportTickets.id,id));throw error}
    await audit(user?.id??null,'support.ticket_created','support_ticket',id,{reference,category,urgency,attachment:Boolean(attachment)},request);
    const admin=supportAdminEmail(); const notification=`Nouvelle demande ${reference}\n\n${firstName} ${lastName} (${email})\nCatégorie : ${category}\nObjet : ${subject}\nPièce jointe : ${attachment?'oui':'non'}\n\nConsultez l’espace Administration pour répondre.`;
    await Promise.all([admin?sendTransactionalEmail({to:admin,subject:`[${reference}] Nouvelle demande d’assistance`,text:notification}):false,sendTransactionalEmail({to:email,subject:`Votre demande ${reference} a bien été enregistrée`,text:`Bonjour ${firstName},\n\nVotre demande « ${subject} » a bien été enregistrée sous la référence ${reference}. Une réponse vous sera apportée sous un jour ouvré.\n\nNe répondez jamais en envoyant un mot de passe, un code secret ou une clé API.`})]);
    return jsonOk({reference,message:'Votre demande a bien été enregistrée. Conservez sa référence pour vos échanges.'},201);
  }catch(error){if(objectKey)await env.FILES.delete(objectKey).catch(()=>undefined);return jsonError(error)}
}

async function ticketBody(request:Request):Promise<{body:Record<string,unknown>;file:File|null}>{
  if((request.headers.get('content-type')??'').includes('multipart/form-data')){const form=await request.formData();const entry=form.get('attachment');const body=Object.fromEntries([...form.entries()].filter(([key])=>key!=='attachment').map(([key,value])=>[key,String(value)]));return{body,file:entry instanceof File&&entry.size?entry:null}}
  return{body:await readJson(request,40_000),file:null};
}

function truthy(value:unknown):boolean{return value===true||value==='true'||value==='on'}
function safePage(value:unknown):string{const raw=String(value??'').trim();if(!raw)return'';try{const url=new URL(raw,env.NEXT_PUBLIC_SITE_URL||'https://progressed-pedago.invalid');return url.origin===(env.NEXT_PUBLIC_SITE_URL?new URL(env.NEXT_PUBLIC_SITE_URL).origin:url.origin)?`${url.pathname}${url.search}`.slice(0,500):''}catch{return''}}
