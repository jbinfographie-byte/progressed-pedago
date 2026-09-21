import { env } from '@/lib/runtime-env';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { supportAttachments, supportTickets } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { AppError, jsonError } from '@/lib/http';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  try{
    const user=await getCurrentUser();if(!user)throw new AppError(401,'Connectez-vous pour consulter cette pièce jointe.','SESSION_REQUIRED');
    const id=(await context.params).id;const row=(await getDb().select({attachment:supportAttachments,ticket:supportTickets}).from(supportAttachments).innerJoin(supportTickets,eq(supportAttachments.ticketId,supportTickets.id)).where(eq(supportAttachments.id,id)).limit(1))[0];
    if(!row)throw new AppError(404,'Cette pièce jointe est introuvable.','ATTACHMENT_NOT_FOUND');
    if(user.role!=='admin'&&row.ticket.requesterId!==user.id)throw new AppError(403,'Vous ne pouvez pas consulter cette pièce jointe.','ATTACHMENT_FORBIDDEN');
    const object=await env.FILES.get(row.attachment.objectKey);if(!object)throw new AppError(404,'Le fichier associé est introuvable.','ATTACHMENT_OBJECT_NOT_FOUND');
    return new Response(object.body,{headers:{'Content-Type':row.attachment.mimeType,'Content-Length':String(row.attachment.sizeBytes),'Content-Disposition':`attachment; filename="${row.attachment.originalName.replace(/["\\]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return jsonError(error)}
}
