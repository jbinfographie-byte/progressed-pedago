import { env } from '@/lib/runtime-env';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { learnerAssignments, learnerSubmissions } from '@/db/schema';
import { audit, requireUser } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk } from '@/lib/http';

export async function GET(_:Request,context:{params:Promise<{id:string}>}){try{const user=await requireUser();const id=(await context.params).id;const row=(await getDb().select({submission:learnerSubmissions,trainerId:learnerAssignments.trainerId}).from(learnerSubmissions).innerJoin(learnerAssignments,eq(learnerAssignments.id,learnerSubmissions.assignmentId)).where(eq(learnerSubmissions.id,id)).limit(1))[0];if(!row||!(user.role==='admin'||row.submission.learnerId===user.id||row.trainerId===user.id))throw new AppError(404,'Ce fichier est introuvable.','FILE_NOT_FOUND');const object=await env.FILES.get(row.submission.objectKey);if(!object)throw new AppError(404,'Ce fichier est indisponible.','FILE_NOT_FOUND');return new Response(object.body,{headers:{'Content-Type':row.submission.mimeType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.submission.originalName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return jsonError(error);}}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  try{
    assertSameOrigin(request);
    const user=await requireUser();
    const id=(await context.params).id;
    const row=(await getDb().select({submission:learnerSubmissions,trainerId:learnerAssignments.trainerId}).from(learnerSubmissions).innerJoin(learnerAssignments,eq(learnerAssignments.id,learnerSubmissions.assignmentId)).where(eq(learnerSubmissions.id,id)).limit(1))[0];
    if(!row||!(user.role==='admin'||row.submission.learnerId===user.id||row.trainerId===user.id))throw new AppError(404,'Ce fichier est introuvable.','FILE_NOT_FOUND');
    if(user.role==='learner'&&!['submitted','retry'].includes(row.submission.status))throw new AppError(409,'Ce document est déjà en cours de correction ou validé. Demandez à votre formateur de le retirer.','SUBMISSION_LOCKED');
    await getDb().delete(learnerSubmissions).where(eq(learnerSubmissions.id,id));
    try{await env.FILES.delete(row.submission.objectKey);}catch{/* La fiche retirée ne doit pas réapparaître si le nettoyage du stockage est momentanément indisponible. */}
    await audit(user.id,'learner.submission_deleted','learner_submission',id,{ownerId:row.submission.learnerId,originalName:row.submission.originalName},request);
    return jsonOk({message:'Le document a été retiré sans erreur.'});
  }catch(error){return jsonError(error);}
}
