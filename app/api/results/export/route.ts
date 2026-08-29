import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, learnerResults, mainFolders } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { jsonError } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('exportResults');
    const params = new URL(request.url).searchParams;
    const activityId = params.get('activityId')?.trim(); const trainingId = params.get('trainingId')?.trim(); const mainFolderId = params.get('mainFolderId')?.trim();
    const clauses = [eq(learnerResults.trainerId,user.id)];
    if (activityId) clauses.push(eq(learnerResults.activityId,activityId));
    if (trainingId) clauses.push(eq(learnerResults.trainingId,trainingId));
    if (mainFolderId) clauses.push(eq(courseFolders.mainFolderId,mainFolderId));
    const rows = await getDb().select({
      grandTheme:mainFolders.name,formation:courseFolders.name,activite:activities.title,prenom:learnerResults.learnerFirstName,nom:learnerResults.learnerLastName,
      score:learnerResults.score,maximum:learnerResults.maxScore,pourcentage:learnerResults.percentage,dureeSecondes:learnerResults.durationSeconds,
      tentative:learnerResults.attempt,date:learnerResults.createdAt,
    }).from(learnerResults)
      .innerJoin(activities,eq(learnerResults.activityId,activities.id))
      .leftJoin(courseFolders,eq(learnerResults.trainingId,courseFolders.id))
      .leftJoin(mainFolders,eq(courseFolders.mainFolderId,mainFolders.id))
      .where(and(...clauses));
    const headers = ['Grand thème','Formation','Activité','Prénom','Nom','Score','Maximum','Pourcentage','Durée (s)','Tentative','Date'];
    const escape=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;
    const csv='\uFEFF'+[headers.map(escape).join(';'),...rows.map((row)=>[row.grandTheme,row.formation,row.activite,row.prenom,row.nom,row.score,row.maximum,row.pourcentage,row.dureeSecondes,row.tentative,new Date(row.date*1000).toLocaleString('fr-FR')].map(escape).join(';'))].join('\n');
    return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="resultats-progressed-pedago.csv"'}});
  } catch(error) { return jsonError(error); }
}
