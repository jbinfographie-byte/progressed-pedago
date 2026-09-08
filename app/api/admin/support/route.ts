import { env } from 'cloudflare:workers';
import { and, desc, eq, gte, like, lte, or, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { helpArticles, salesLeads, supportAttachments, supportMessages, supportTickets } from '@/db/schema';
import { audit, requireAdmin } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { sendTransactionalEmail } from '@/lib/notifications';
import { cleanText, LEAD_STATUSES, TICKET_STATUSES } from '@/lib/support';

export async function GET(request:Request){
  try{
    await requireAdmin();const url=new URL(request.url);const search=String(url.searchParams.get('q')??'').trim().slice(0,120);const status=String(url.searchParams.get('status')??'').trim();const category=String(url.searchParams.get('category')??'').trim();const urgency=String(url.searchParams.get('urgency')??'').trim();const plan=String(url.searchParams.get('plan')??'').trim().slice(0,80);const conditions:SQL[]=[];
    if(status)conditions.push(eq(supportTickets.status,status as typeof supportTickets.$inferSelect.status));if(category)conditions.push(eq(supportTickets.category,category));if(urgency)conditions.push(eq(supportTickets.urgency,urgency as typeof supportTickets.$inferSelect.urgency));if(plan)conditions.push(like(supportTickets.planName,`%${plan}%`));
    const dateFrom=dateValue(url.searchParams.get('dateFrom'),false);const dateTo=dateValue(url.searchParams.get('dateTo'),true);if(dateFrom)conditions.push(gte(supportTickets.createdAt,dateFrom));if(dateTo)conditions.push(lte(supportTickets.createdAt,dateTo));
    if(search)conditions.push(or(like(supportTickets.reference,`%${search}%`),like(supportTickets.email,`%${search}%`),like(supportTickets.subject,`%${search}%`),like(supportTickets.description,`%${search}%`))!);
    const tickets=await getDb().select().from(supportTickets).where(conditions.length?and(...conditions):undefined).orderBy(desc(supportTickets.updatedAt)).limit(500);
    if(url.searchParams.get('format')==='csv')return csvResponse(tickets);
    const enriched=await Promise.all(tickets.map(async(ticket)=>({...ticket,messages:await getDb().select().from(supportMessages).where(eq(supportMessages.ticketId,ticket.id)).orderBy(supportMessages.createdAt),attachments:(await getDb().select({id:supportAttachments.id,originalName:supportAttachments.originalName,mimeType:supportAttachments.mimeType,sizeBytes:supportAttachments.sizeBytes}).from(supportAttachments).where(eq(supportAttachments.ticketId,ticket.id))).map((attachment)=>({...attachment,url:`/api/support/attachments/${attachment.id}`}))})));
    const leads=await getDb().select().from(salesLeads).orderBy(desc(salesLeads.updatedAt)).limit(200);const articles=await getDb().select().from(helpArticles).orderBy(desc(helpArticles.updatedAt)).limit(200);return jsonOk({tickets:enriched,leads,articles});
  }catch(error){return jsonError(error)}
}

export async function POST(request:Request){
  try{
    assertSameOrigin(request);const admin=await requireAdmin();const body=await readJson(request,30_000);const action=String(body.action??'');const now=Math.floor(Date.now()/1000);
    if(action==='ticket_update'||action==='ticket_reply'){
      const id=String(body.id??'');const ticket=(await getDb().select().from(supportTickets).where(eq(supportTickets.id,id)).limit(1))[0];if(!ticket)throw new AppError(404,'Ticket introuvable.','TICKET_NOT_FOUND');
      const status=TICKET_STATUSES.includes(String(body.status) as typeof TICKET_STATUSES[number])?String(body.status) as typeof supportTickets.$inferSelect.status:ticket.status;const priority=['low','normal','high','critical'].includes(String(body.priority))?String(body.priority) as typeof supportTickets.$inferSelect.priority:ticket.priority;const reply=cleanText(body.reply,8_000,'La réponse',false);const internalNote=cleanText(body.internalNote??ticket.internalNote,4_000,'La note interne',false);const resolvedAt=status==='resolved'?now:status===ticket.status?ticket.resolvedAt:null;const closedAt=status==='closed'?now:status===ticket.status?ticket.closedAt:null;
      await getDb().update(supportTickets).set({status,priority,internalNote,assignedTo:admin.id,resolvedAt,closedAt,updatedAt:now}).where(eq(supportTickets.id,id));if(reply)await getDb().insert(supportMessages).values({id:crypto.randomUUID(),ticketId:id,authorId:admin.id,authorRole:'support',message:reply,createdAt:now});if(reply)await sendTransactionalEmail({to:ticket.email,subject:`[${ticket.reference}] Réponse de Progressed Pédago`,text:`Bonjour ${ticket.firstName},\n\n${reply}\n\nRéférence : ${ticket.reference}`});await audit(admin.id,'support.ticket_updated','support_ticket',id,{status,priority,replied:Boolean(reply)},request);return jsonOk({message:reply?'La réponse a été enregistrée et envoyée.':'Le ticket a été mis à jour.'});
    }
    if(action==='ticket_delete'){
      const id=String(body.id??'');const ticket=(await getDb().select().from(supportTickets).where(eq(supportTickets.id,id)).limit(1))[0];if(!ticket)throw new AppError(404,'Ticket introuvable.','TICKET_NOT_FOUND');const attachments=await getDb().select({objectKey:supportAttachments.objectKey}).from(supportAttachments).where(eq(supportAttachments.ticketId,id));await audit(admin.id,'support.ticket_deleted','support_ticket',id,{reference:ticket.reference,attachments:attachments.length},request);await Promise.all(attachments.map((attachment)=>env.FILES.delete(attachment.objectKey)));await getDb().delete(supportTickets).where(eq(supportTickets.id,id));return jsonOk({message:`La demande ${ticket.reference} et ses pièces jointes ont été supprimées.`});
    }
    if(action==='lead_update'){
      const id=String(body.id??'');const lead=(await getDb().select().from(salesLeads).where(eq(salesLeads.id,id)).limit(1))[0];if(!lead)throw new AppError(404,'Demande commerciale introuvable.','LEAD_NOT_FOUND');const status=LEAD_STATUSES.includes(String(body.status) as typeof LEAD_STATUSES[number])?String(body.status) as typeof salesLeads.$inferSelect.status:lead.status;const internalNote=cleanText(body.internalNote??lead.internalNote,4_000,'La note interne',false);await getDb().update(salesLeads).set({status,internalNote,updatedAt:now}).where(eq(salesLeads.id,id));await audit(admin.id,'sales.lead_updated','sales_lead',id,{status},request);return jsonOk({message:'La demande commerciale a été mise à jour.'});
    }
    throw new AppError(400,'Action d’assistance inconnue.','SUPPORT_ACTION_INVALID');
  }catch(error){return jsonError(error)}
}

function dateValue(value:string|null,end:boolean):number{if(!value)return 0;const parsed=Date.parse(`${value}T${end?'23:59:59':'00:00:00'}Z`);return Number.isFinite(parsed)?Math.floor(parsed/1000):0}
function csvResponse(tickets:Array<typeof supportTickets.$inferSelect>):Response{const rows=[['Référence','Date','Statut','Urgence','Priorité','Catégorie','Formule','Prénom','Nom','E-mail','Organisme','Objet'],...tickets.map((ticket)=>[ticket.reference,new Date(ticket.createdAt*1000).toISOString(),ticket.status,ticket.urgency,ticket.priority,ticket.category,ticket.planName,ticket.firstName,ticket.lastName,ticket.email,ticket.organization,ticket.subject])];const csv='\uFEFF'+rows.map((row)=>row.map(csvCell).join(';')).join('\r\n');return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="tickets-progressed-pedago-${new Date().toISOString().slice(0,10)}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
function csvCell(value:unknown):string{let text=String(value??'').replace(/[\r\n]+/g,' ');if(/^[=+\-@]/.test(text))text=`'${text}`;return`"${text.replaceAll('"','""')}"`}
