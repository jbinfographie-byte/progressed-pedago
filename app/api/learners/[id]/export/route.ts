import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, learnerAccountProgress, learnerAssignments } from '@/db/schema';
import { requireStaff } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import { assertStaffLearnerAccess } from '@/lib/learner-access';

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireStaff();
    const learnerId = (await context.params).id;
    const learner = await assertStaffLearnerAccess(actor, learnerId);
    const rows = await getDb().select({
      parcours: courseFolders.name,
      activite: activities.title,
      statut: learnerAccountProgress.status,
      note: learnerAccountProgress.score,
      bareme: learnerAccountProgress.maxScore,
      tentatives: learnerAccountProgress.attempts,
      dureeSecondes: learnerAccountProgress.durationSeconds,
      debut: learnerAccountProgress.startedAt,
      fin: learnerAccountProgress.completedAt,
      miseAJour: learnerAccountProgress.updatedAt,
    }).from(learnerAccountProgress)
      .innerJoin(learnerAssignments, eq(learnerAssignments.id, learnerAccountProgress.assignmentId))
      .innerJoin(courseFolders, eq(courseFolders.id, learnerAssignments.trainingId))
      .innerJoin(activities, eq(activities.id, learnerAccountProgress.activityId))
      .where(eq(learnerAccountProgress.learnerId, learnerId))
      .orderBy(desc(learnerAccountProgress.updatedAt));
    const header = ['Apprenant', 'E-mail', 'Parcours', 'Activité', 'Statut', 'Note', 'Barème', 'Tentatives', 'Durée (secondes)', 'Début', 'Fin', 'Mise à jour'];
    const formatDate = (value: number | null) => value ? new Date(value * 1000).toISOString() : '';
    const lines = [header.map(csvCell).join(';'), ...rows.map((row) => [
      learner.displayName ?? `${learner.firstName ?? ''} ${learner.lastName ?? ''}`.trim(), learner.email,
      row.parcours, row.activite, row.statut, row.note, row.bareme, row.tentatives, row.dureeSecondes,
      formatDate(row.debut), formatDate(row.fin), formatDate(row.miseAJour),
    ].map(csvCell).join(';'))];
    const fileName = `progression-${(learner.displayName ?? 'apprenant').normalize('NFKD').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-').toLowerCase()}.csv`;
    return new Response(`\uFEFF${lines.join('\r\n')}`, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return jsonError(error); }
}
