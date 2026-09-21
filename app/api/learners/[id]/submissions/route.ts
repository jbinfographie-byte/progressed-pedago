import { env } from '@/lib/runtime-env';
import { and, eq, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { learnerAssignments, learnerNotifications, learnerSubmissions } from '@/db/schema';
import { audit, requireStaff } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk } from '@/lib/http';
import { assertStaffLearnerAccess, cleanText } from '@/lib/learner-access';
import { MAX_LEARNER_FILE_BYTES, safeFileName, validateLearnerFile } from '@/lib/learner-files';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireStaff();
    const learnerId = (await context.params).id;
    await assertStaffLearnerAccess(actor, learnerId);
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_LEARNER_FILE_BYTES + 1_000_000) throw new AppError(413, 'Le fichier doit peser moins de 25 Mo.', 'FILE_TOO_LARGE');

    const form = await request.formData();
    const assignmentId = cleanText(form.get('assignmentId'), 100);
    const comment = cleanText(form.get('comment'), 2000);
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError(400, 'Choisissez un fichier à envoyer.', 'FILE_REQUIRED');

    const assignment = (await getDb().select().from(learnerAssignments).where(and(
      eq(learnerAssignments.id, assignmentId),
      eq(learnerAssignments.learnerId, learnerId),
      ne(learnerAssignments.status, 'removed'),
    )).limit(1))[0];
    if (!assignment || (actor.role === 'trainer' && assignment.trainerId !== actor.id)) throw new AppError(404, 'Ce parcours est introuvable.', 'ASSIGNMENT_NOT_FOUND');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateLearnerFile(file, bytes);
    const id = crypto.randomUUID();
    const objectKey = `learner-submissions/${learnerId}/${assignmentId}/${id}-${safeFileName(file.name)}`;
    await env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: validated.mimeType } });
    try {
      await getDb().batch([
        getDb().insert(learnerSubmissions).values({
          id, assignmentId, learnerId, objectKey, originalName: file.name.slice(0, 180),
          mimeType: validated.mimeType, sizeBytes: file.size, learnerComment: comment,
          trainerComment: 'Document ajouté par l’équipe pédagogique.',
        }),
        getDb().insert(learnerNotifications).values({
          id: crypto.randomUUID(), userId: learnerId, kind: 'submission', title: 'Un document a été ajouté à votre parcours',
          body: `Le document ${file.name.slice(0, 100)} est disponible dans vos productions.`, link: '/?learner=results',
        }),
      ]);
    } catch (error) {
      await env.FILES.delete(objectKey);
      throw error;
    }
    await audit(actor.id, 'staff.learner_submission_uploaded', 'learner_submission', id, { learnerId, assignmentId, mimeType: validated.mimeType, size: file.size }, request);
    return jsonOk({ id, message: 'Le document a été ajouté aux productions de l’apprenant.' }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
