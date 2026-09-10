import { env } from 'cloudflare:workers';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, learnerAccountProgress, learnerAssignments, learnerEvaluationHistory, learnerEvaluations, learnerMessages, learnerNotifications, learnerOverallAssessments, learnerProfiles, learnerSubmissions, users } from '@/db/schema';
import { audit, requireStaff } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { assertStaffLearnerAccess, cleanOptionalEpoch, cleanText, upsertAssignment } from '@/lib/learner-access';
import { learnerAccessEmail, learnerAccessUrl } from '@/lib/learner-access-email';
import { sendTransactionalEmail } from '@/lib/notifications';
import { buildResultCorrection } from '@/lib/result-corrections';
import type { ActivityType } from '@/lib/activity-types';
import { normalizeVoiceSessionDurationSeconds } from '@/lib/voice-session-duration';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireStaff();
    const learnerId = (await context.params).id;
    const learner = await assertStaffLearnerAccess(actor, learnerId);
    const assignments = await getDb().select({
      id: learnerAssignments.id, trainingId: learnerAssignments.trainingId, trainingName: courseFolders.name,
      trainerId: learnerAssignments.trainerId, status: learnerAssignments.status, resultVisible: learnerAssignments.resultVisible,
      commentsVisible: learnerAssignments.commentsVisible, manualValidation: learnerAssignments.manualValidation,
    }).from(learnerAssignments).innerJoin(courseFolders, eq(courseFolders.id, learnerAssignments.trainingId))
      .where(and(eq(learnerAssignments.learnerId, learnerId), ne(learnerAssignments.status, 'removed')));
    const progress = await getDb().select({
      id: learnerAccountProgress.id, assignmentId: learnerAccountProgress.assignmentId, activityId: learnerAccountProgress.activityId,
      activityTitle: activities.title, activityType: activities.type, activityContentJson: activities.contentJson,
      activityCorrection: activities.correction, status: learnerAccountProgress.status, score: learnerAccountProgress.score,
      maxScore: learnerAccountProgress.maxScore, attempts: learnerAccountProgress.attempts,
      durationSeconds: learnerAccountProgress.durationSeconds, answersJson: learnerAccountProgress.answersJson,
      startedAt: learnerAccountProgress.startedAt, completedAt: learnerAccountProgress.completedAt, updatedAt: learnerAccountProgress.updatedAt,
    }).from(learnerAccountProgress).innerJoin(activities, eq(activities.id, learnerAccountProgress.activityId))
      .where(eq(learnerAccountProgress.learnerId, learnerId)).orderBy(desc(learnerAccountProgress.updatedAt));
    const evaluations = await getDb().select().from(learnerEvaluations).where(eq(learnerEvaluations.learnerId, learnerId)).orderBy(desc(learnerEvaluations.updatedAt));
    const submissions = await getDb().select({
      id: learnerSubmissions.id, assignmentId: learnerSubmissions.assignmentId, activityId: learnerSubmissions.activityId,
      originalName: learnerSubmissions.originalName, mimeType: learnerSubmissions.mimeType, sizeBytes: learnerSubmissions.sizeBytes,
      status: learnerSubmissions.status, score: learnerSubmissions.score, maxScore: learnerSubmissions.maxScore, learnerComment: learnerSubmissions.learnerComment,
      trainerComment: learnerSubmissions.trainerComment, createdAt: learnerSubmissions.createdAt, updatedAt: learnerSubmissions.updatedAt,
    }).from(learnerSubmissions).where(eq(learnerSubmissions.learnerId, learnerId)).orderBy(desc(learnerSubmissions.createdAt));
    const overallAssessment = (await getDb().select().from(learnerOverallAssessments).where(eq(learnerOverallAssessments.learnerId, learnerId)).limit(1))[0] ?? null;
    const messages = await getDb().select({
      id: learnerMessages.id, trainerId: learnerMessages.trainerId, authorId: learnerMessages.authorId,
      body: learnerMessages.body, readAt: learnerMessages.readAt, createdAt: learnerMessages.createdAt,
    }).from(learnerMessages).where(eq(learnerMessages.learnerId, learnerId)).orderBy(asc(learnerMessages.createdAt));
    const publicProgress = progress.map(({ answersJson, activityContentJson, activityCorrection, ...row }) => {
      const answers = parseJson<unknown>(answersJson, []);
      return {
        ...row,
        correctionDetails: buildResultCorrection(
          row.activityType as ActivityType,
          parseJson<Record<string, unknown>>(activityContentJson, {}),
          answers,
          activityCorrection,
        ),
      };
    });
    const evaluationByActivity = new Map(evaluations.map((row) => [`${row.assignmentId}:${row.activityId}`, row]));
    const scoredItems = [
      ...progress.map((row) => evaluationByActivity.get(`${row.assignmentId}:${row.activityId}`) ?? row),
      ...submissions,
    ].filter((row) => row.score != null && row.maxScore != null && row.maxScore > 0);
    const overallMetrics = {
      averagePercent: scoredItems.length ? Math.round(scoredItems.reduce((sum, row) => sum + Number(row.score) / Number(row.maxScore) * 100, 0) / scoredItems.length) : null,
      gradedItems: scoredItems.length,
      completedActivities: progress.filter((row) => ['completed', 'validated'].includes(row.status)).length,
      startedActivities: progress.length,
      validatedSubmissions: submissions.filter((row) => row.status === 'validated').length,
      totalSubmissions: submissions.length,
      completedPaths: assignments.filter((row) => row.status === 'completed').length,
      totalPaths: assignments.length,
    };
    return jsonOk({ learner, assignments, progress: publicProgress, evaluations, submissions, overallAssessment, overallMetrics, messages });
  } catch (error) { return jsonError(error); }
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireStaff();
    const learnerId = (await context.params).id;
    const learner = await assertStaffLearnerAccess(actor, learnerId);
    const body = await readJson(request);
    const action = String(body.action ?? 'update_profile');
    const now = Math.floor(Date.now() / 1000);
    if (action === 'send_access_link') {
      if (actor.role !== 'admin') throw new AppError(403, 'Seul l’administrateur peut renvoyer ce lien de connexion.', 'ADMIN_REQUIRED');
      if (learner.status !== 'active') throw new AppError(409, 'Activez d’abord le compte apprenant avant de renvoyer son lien.', 'LEARNER_NOT_ACTIVE');
      const accessUrl = learnerAccessUrl(request.url, env.NEXT_PUBLIC_SITE_URL);
      const emailContent = learnerAccessEmail({ firstName: learner.firstName, accessUrl });
      const sent = await sendTransactionalEmail({ to: learner.email, ...emailContent });
      const mailto = sent ? undefined : `mailto:${encodeURIComponent(learner.email)}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.text)}`;
      await audit(actor.id, 'learner.access_link_resent', 'user', learnerId, { sent }, request);
      return jsonOk({ sent, accessUrl, mailto, message: sent ? 'Le lien permanent de connexion a été renvoyé à l’apprenant.' : 'Le message prêt à envoyer a été ouvert dans votre messagerie.' });
    }
    if (action === 'update_profile') {
      const firstName = cleanText(body.firstName, 80); const lastName = cleanText(body.lastName, 80);
      if (!firstName || !lastName) throw new AppError(400, 'Le prénom et le nom sont obligatoires.', 'NAME_REQUIRED');
      const trainerId = actor.role === 'admin' ? cleanText(body.trainerId, 100) || null : actor.id;
      if (trainerId) {
        const trainer = (await getDb().select({ id: users.id }).from(users).where(and(eq(users.id, trainerId), eq(users.role, 'trainer'), eq(users.status, 'active'))).limit(1))[0];
        if (!trainer) throw new AppError(400, 'Le formateur référent est invalide.', 'INVALID_TRAINER');
      }
      await getDb().update(users).set({ firstName, lastName, displayName: `${firstName} ${lastName}`, updatedAt: now }).where(eq(users.id, learnerId));
      await getDb().update(learnerProfiles).set({ organization: cleanText(body.organization, 120), groupName: cleanText(body.groupName, 120), assignedTrainerId: trainerId, updatedAt: now }).where(eq(learnerProfiles.userId, learnerId));
      await audit(actor.id, 'learner.profile_updated', 'user', learnerId, {}, request);
      return jsonOk({ message: 'La fiche apprenant est mise à jour.' });
    }
    if (action === 'set_status') {
      if (actor.role !== 'admin') throw new AppError(403, 'Seul l’administrateur peut modifier l’accès au compte.', 'ADMIN_REQUIRED');
      const status = String(body.status ?? '');
      if (!['active', 'suspended', 'revoked'].includes(status)) throw new AppError(400, 'Statut invalide.', 'INVALID_STATUS');
      await getDb().update(users).set({ status: status as 'active' | 'suspended' | 'revoked', updatedAt: now }).where(eq(users.id, learnerId));
      await audit(actor.id, 'learner.status_updated', 'user', learnerId, { status }, request);
      return jsonOk({ message: status === 'active' ? 'Compte apprenant actif.' : status === 'suspended' ? 'Compte apprenant suspendu.' : 'Accès apprenant révoqué.' });
    }
    if (action === 'assign') {
      const trainingId = cleanText(body.trainingId, 100);
      const training = (await getDb().select({ id: courseFolders.id, trainerId: courseFolders.trainerId }).from(courseFolders).where(eq(courseFolders.id, trainingId)).limit(1))[0];
      if (!training || (actor.role === 'trainer' && training.trainerId !== actor.id)) throw new AppError(404, 'Ce parcours est introuvable.', 'TRAINING_NOT_FOUND');
      const trainerId = actor.role === 'admin' ? cleanText(body.trainerId, 100) || training.trainerId : actor.id;
      await upsertAssignment({
        learnerId, trainingId, trainerId, startsAt: cleanOptionalEpoch(body.startsAt), dueAt: cleanOptionalEpoch(body.dueAt),
        orderMode: body.orderMode === 'free' ? 'free' : 'sequential', maxAttempts: Number(body.maxAttempts) || 3,
        resultVisible: body.resultVisible !== false, commentsVisible: body.commentsVisible !== false,
        uploadAllowed: body.uploadAllowed !== false, chatAllowed: body.chatAllowed !== false,
        voiceAllowed: body.voiceAllowed !== false, voiceDurationSeconds: normalizeVoiceSessionDurationSeconds(body.voiceDurationSeconds),
        manualValidation: body.manualValidation === true,
      });
      await audit(actor.id, 'learner.training_assigned', 'user', learnerId, { trainingId, trainerId }, request);
      return jsonOk({ message: 'Le parcours est attribué à l’apprenant.' });
    }
    if (action === 'remove_assignment') {
      const assignmentId = cleanText(body.assignmentId, 100);
      const assignment = (await getDb().select().from(learnerAssignments).where(and(eq(learnerAssignments.id, assignmentId), eq(learnerAssignments.learnerId, learnerId))).limit(1))[0];
      if (!assignment || (actor.role === 'trainer' && assignment.trainerId !== actor.id)) throw new AppError(404, 'Cette attribution est introuvable.', 'ASSIGNMENT_NOT_FOUND');
      await getDb().update(learnerAssignments).set({ status: 'removed', updatedAt: now }).where(eq(learnerAssignments.id, assignmentId));
      await audit(actor.id, 'learner.training_removed', 'learner_assignment', assignmentId, { preserveResults: true }, request);
      return jsonOk({ message: 'Le parcours est retiré. Les résultats sont conservés.' });
    }
    if (action === 'message') {
      const bodyText = cleanText(body.message, 4000);
      if (!bodyText) throw new AppError(400, 'Le message est vide.', 'EMPTY_MESSAGE');
      const profile = (await getDb().select().from(learnerProfiles).where(eq(learnerProfiles.userId, learnerId)).limit(1))[0];
      const trainerId = actor.role === 'trainer' ? actor.id : cleanText(body.trainerId, 100) || profile?.assignedTrainerId;
      if (!trainerId) throw new AppError(400, 'Aucun formateur référent n’est attribué.', 'TRAINER_REQUIRED');
      await getDb().batch([
        getDb().insert(learnerMessages).values({ id: crypto.randomUUID(), learnerId, trainerId, authorId: actor.id, body: bodyText }),
        getDb().insert(learnerNotifications).values({ id: crypto.randomUUID(), userId: learnerId, kind: 'message', title: 'Nouveau message de votre formateur', body: bodyText.slice(0, 180), link: '/?learner=messages' }),
      ]);
      return jsonOk({ message: 'Message envoyé à l’apprenant.' });
    }
    if (action === 'evaluate') {
      const assignmentId = cleanText(body.assignmentId, 100); const activityId = cleanText(body.activityId, 100);
      const assignment = (await getDb().select().from(learnerAssignments).where(and(eq(learnerAssignments.id, assignmentId), eq(learnerAssignments.learnerId, learnerId))).limit(1))[0];
      const activity = (await getDb().select({ id: activities.id }).from(activities).where(eq(activities.id, activityId)).limit(1))[0];
      if (!assignment || !activity || (actor.role === 'trainer' && assignment.trainerId !== actor.id)) throw new AppError(404, 'L’activité à évaluer est introuvable.', 'EVALUATION_TARGET_NOT_FOUND');
      const status = ['submitted', 'reviewing', 'validated', 'retry'].includes(String(body.status)) ? String(body.status) as 'submitted' | 'reviewing' | 'validated' | 'retry' : 'validated';
      const attempt = Math.min(100, Math.max(1, Number(body.attempt) || 1));
      const current = (await getDb().select().from(learnerEvaluations).where(and(eq(learnerEvaluations.assignmentId, assignmentId), eq(learnerEvaluations.activityId, activityId), eq(learnerEvaluations.attempt, attempt))).limit(1))[0];
      const score = body.score === '' || body.score == null ? null : Math.max(0, Number(body.score));
      const maxScore = body.maxScore === '' || body.maxScore == null ? null : Math.max(1, Number(body.maxScore));
      if ((score != null && !Number.isFinite(score)) || (maxScore != null && !Number.isFinite(maxScore)) || (score != null && maxScore != null && score > maxScore)) throw new AppError(400, 'La note saisie est invalide.', 'INVALID_SCORE');
      const values = { learnerId, trainerId: assignment.trainerId, status, score, maxScore, publicComment: cleanText(body.publicComment, 4000), internalNote: cleanText(body.internalNote, 4000), updatedAt: now };
      const evaluationId = current?.id ?? crypto.randomUUID();
      if (current) await getDb().update(learnerEvaluations).set(values).where(eq(learnerEvaluations.id, current.id));
      else await getDb().insert(learnerEvaluations).values({ id: evaluationId, assignmentId, activityId, attempt, ...values });
      await getDb().update(learnerAccountProgress).set({ status: status === 'validated' ? 'validated' : status === 'retry' ? 'retry' : 'submitted', score, maxScore, updatedAt: now }).where(and(eq(learnerAccountProgress.assignmentId, assignmentId), eq(learnerAccountProgress.activityId, activityId), eq(learnerAccountProgress.learnerId, learnerId)));
      await getDb().insert(learnerEvaluationHistory).values({ id: crypto.randomUUID(), evaluationId, actorId: actor.id, action: current ? 'updated' : 'created', beforeJson: JSON.stringify(current ?? {}), afterJson: JSON.stringify(values) });
      if (values.publicComment || status === 'validated' || status === 'retry') await getDb().insert(learnerNotifications).values({ id: crypto.randomUUID(), userId: learnerId, kind: 'evaluation', title: status === 'retry' ? 'Une nouvelle tentative est demandée' : 'Une activité a été corrigée', body: values.publicComment, link: '/?learner=results' });
      return jsonOk({ message: 'Évaluation enregistrée avec traçabilité.' });
    }
    if (action === 'review_submission') {
      const submissionId = cleanText(body.submissionId, 100); const status = String(body.status ?? 'reviewing');
      if (!['reviewing', 'validated', 'retry'].includes(status)) throw new AppError(400, 'Statut invalide.', 'INVALID_STATUS');
      const submission = (await getDb().select().from(learnerSubmissions).where(and(eq(learnerSubmissions.id, submissionId), eq(learnerSubmissions.learnerId, learnerId))).limit(1))[0];
      if (!submission) throw new AppError(404, 'Cette production est introuvable.', 'SUBMISSION_NOT_FOUND');
      const assignment = (await getDb().select({ trainerId: learnerAssignments.trainerId }).from(learnerAssignments).where(and(eq(learnerAssignments.id, submission.assignmentId), eq(learnerAssignments.learnerId, learnerId))).limit(1))[0];
      if (!assignment || (actor.role === 'trainer' && assignment.trainerId !== actor.id)) throw new AppError(403, 'Cette production ne vous est pas attribuée.', 'SUBMISSION_ACCESS_DENIED');
      const { score, maxScore } = readScore(body.score, body.maxScore);
      const trainerComment = cleanText(body.comment, 4000);
      await getDb().update(learnerSubmissions).set({ status: status as 'reviewing' | 'validated' | 'retry', score, maxScore, trainerComment, updatedAt: now }).where(eq(learnerSubmissions.id, submissionId));
      if (trainerComment || status === 'validated' || status === 'retry') await getDb().insert(learnerNotifications).values({ id: crypto.randomUUID(), userId: learnerId, kind: 'submission_review', title: status === 'retry' ? 'Une nouvelle version de votre document est demandée' : 'Un document a été corrigé', body: trainerComment, link: '/?learner=results' });
      await audit(actor.id, 'learner.submission_reviewed', 'learner_submission', submissionId, { status, score, maxScore }, request);
      return jsonOk({ message: 'Le suivi de la production est mis à jour.' });
    }
    if (action === 'overall_assessment') {
      const status = String(body.status ?? 'in_progress');
      if (!['in_progress', 'validated', 'retry'].includes(status)) throw new AppError(400, 'Statut de bilan invalide.', 'INVALID_STATUS');
      const { score, maxScore } = readScore(body.score, body.maxScore);
      const publicComment = cleanText(body.publicComment, 4000);
      const internalNote = cleanText(body.internalNote, 4000);
      const current = (await getDb().select().from(learnerOverallAssessments).where(eq(learnerOverallAssessments.learnerId, learnerId)).limit(1))[0];
      const values = { assessorId: actor.id, status: status as 'in_progress' | 'validated' | 'retry', score, maxScore, publicComment, internalNote, updatedAt: now };
      if (current) await getDb().update(learnerOverallAssessments).set(values).where(eq(learnerOverallAssessments.id, current.id));
      else await getDb().insert(learnerOverallAssessments).values({ id: crypto.randomUUID(), learnerId, ...values });
      if (publicComment || status !== 'in_progress') await getDb().insert(learnerNotifications).values({ id: crypto.randomUUID(), userId: learnerId, kind: 'overall_assessment', title: 'Votre bilan pédagogique a été mis à jour', body: publicComment, link: '/?learner=results' });
      await audit(actor.id, 'learner.overall_assessment_updated', 'user', learnerId, { status, score, maxScore }, request);
      return jsonOk({ message: 'Le bilan général est enregistré.' });
    }
    throw new AppError(400, 'Action inconnue.', 'INVALID_ACTION');
  } catch (error) { return jsonError(error); }
}

function readScore(rawScore: unknown, rawMaxScore: unknown) {
  const score = rawScore === '' || rawScore == null ? null : Number(rawScore);
  const maxScore = rawMaxScore === '' || rawMaxScore == null ? null : Number(rawMaxScore);
  if ((score != null && (!Number.isFinite(score) || score < 0)) || (maxScore != null && (!Number.isFinite(maxScore) || maxScore <= 0)) || (score != null && maxScore != null && score > maxScore)) throw new AppError(400, 'La note saisie est invalide.', 'INVALID_SCORE');
  return { score, maxScore };
}
