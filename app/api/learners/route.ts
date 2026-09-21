import { env } from '@/lib/runtime-env';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolders, learnerAssignments, learnerInvitations, learnerProfiles, users } from '@/db/schema';
import { audit, requireStaff } from '@/lib/auth';
import { AppError, assertSameOrigin, cleanEmail, jsonError, jsonOk, readJson } from '@/lib/http';
import { cleanText, cleanTrainingIds, upsertAssignment } from '@/lib/learner-access';
import { learnerAccessEmail, learnerAccessUrl } from '@/lib/learner-access-email';
import { sendTransactionalEmail } from '@/lib/notifications';
import { hashPassword, randomToken, sha256, validatePassword } from '@/lib/security';

export async function GET() {
  try {
    const actor = await requireStaff();
    const learnerRows = await getDb().select({
      id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
      displayName: users.displayName, status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      organization: learnerProfiles.organization, groupName: learnerProfiles.groupName,
      assignedTrainerId: learnerProfiles.assignedTrainerId,
    }).from(users).innerJoin(learnerProfiles, eq(learnerProfiles.userId, users.id))
      .where(actor.role === 'admin' ? eq(users.role, 'learner') : and(eq(users.role, 'learner'), eq(learnerProfiles.assignedTrainerId, actor.id)))
      .orderBy(desc(users.createdAt));
    const assignmentRows = await getDb().select({
      id: learnerAssignments.id, learnerId: learnerAssignments.learnerId, trainingId: learnerAssignments.trainingId,
      trainingName: courseFolders.name, trainerId: learnerAssignments.trainerId, startsAt: learnerAssignments.startsAt,
      dueAt: learnerAssignments.dueAt, status: learnerAssignments.status, orderMode: learnerAssignments.orderMode,
      maxAttempts: learnerAssignments.maxAttempts, resultVisible: learnerAssignments.resultVisible,
      commentsVisible: learnerAssignments.commentsVisible, uploadAllowed: learnerAssignments.uploadAllowed,
      chatAllowed: learnerAssignments.chatAllowed, voiceAllowed: learnerAssignments.voiceAllowed,
      voiceDurationSeconds: learnerAssignments.voiceDurationSeconds, manualValidation: learnerAssignments.manualValidation,
    }).from(learnerAssignments).innerJoin(courseFolders, eq(courseFolders.id, learnerAssignments.trainingId))
      .where(actor.role === 'admin' ? ne(learnerAssignments.status, 'removed') : and(eq(learnerAssignments.trainerId, actor.id), ne(learnerAssignments.status, 'removed')));
    const byLearner = new Map<string, typeof assignmentRows>();
    for (const assignment of assignmentRows) byLearner.set(assignment.learnerId, [...(byLearner.get(assignment.learnerId) ?? []), assignment]);
    const trainings = await getDb().select({ id: courseFolders.id, name: courseFolders.name, trainerId: courseFolders.trainerId, status: courseFolders.status })
      .from(courseFolders).where(actor.role === 'admin' ? eq(courseFolders.status, 'published') : and(eq(courseFolders.trainerId, actor.id), eq(courseFolders.status, 'published')))
      .orderBy(desc(courseFolders.updatedAt));
    const trainers = actor.role === 'admin' ? await getDb().select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
      .from(users).where(and(eq(users.role, 'trainer'), eq(users.status, 'active'))) : [{ id: actor.id, email: actor.email, firstName: actor.firstName, lastName: actor.lastName, displayName: actor.displayName }];
    return jsonOk({ learners: learnerRows.map((learner) => ({ ...learner, assignments: byLearner.get(learner.id) ?? [] })), trainings, trainers });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireStaff();
    const body = await readJson(request);
    const action = String(body.action ?? 'invite');
    const email = cleanEmail(body.email);
    const firstName = cleanText(body.firstName, 80);
    const lastName = cleanText(body.lastName, 80);
    if (!firstName || !lastName) throw new AppError(400, 'Le prénom et le nom sont obligatoires.', 'NAME_REQUIRED');
    const trainerId = actor.role === 'admin' ? cleanText(body.trainerId, 100) : actor.id;
    if (!trainerId) throw new AppError(400, 'Choisissez un formateur référent.', 'TRAINER_REQUIRED');
    const trainer = (await getDb().select({ id: users.id }).from(users).where(and(eq(users.id, trainerId), eq(users.role, 'trainer'), eq(users.status, 'active'))).limit(1))[0];
    if (!trainer) throw new AppError(400, 'Le formateur référent est invalide.', 'INVALID_TRAINER');
    const trainingIds = cleanTrainingIds(body.trainingIds);
    if (trainingIds.length) {
      const permittedTrainings = await getDb().select({ id: courseFolders.id }).from(courseFolders).where(and(
        inArray(courseFolders.id, trainingIds),
        eq(courseFolders.status, 'published'),
        ...(actor.role === 'trainer' ? [eq(courseFolders.trainerId, actor.id)] : []),
      ));
      if (permittedTrainings.length !== trainingIds.length) throw new AppError(400, 'Un ou plusieurs parcours sélectionnés sont invalides ou non autorisés.', 'INVALID_TRAINING_SELECTION');
    }
    const organization = cleanText(body.organization, 120);
    const groupName = cleanText(body.groupName, 120);
    const existing = (await getDb().select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1))[0];
    if (existing && existing.role !== 'learner') throw new AppError(409, 'Cette adresse appartient déjà à un compte de l’équipe pédagogique.', 'EMAIL_IN_USE');
    if (action === 'create') {
      const password = String(body.password ?? '');
      if (!existing) {
        const errors = validatePassword(password);
        if (errors.length) throw new AppError(400, errors.join(' '), 'WEAK_PASSWORD');
      }
      const learnerId = existing?.id ?? crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      if (!existing) {
        const passwordData = await hashPassword(password);
        await getDb().insert(users).values({ id: learnerId, email, firstName, lastName, displayName: `${firstName} ${lastName}`, passwordHash: passwordData.hash, passwordSalt: passwordData.salt, role: 'learner', status: 'active', activatedAt: now });
      }
      await getDb().insert(learnerProfiles).values({ userId: learnerId, organization, groupName, assignedTrainerId: trainerId, privacyAcceptedAt: now })
        .onConflictDoUpdate({ target: learnerProfiles.userId, set: { organization, groupName, assignedTrainerId: trainerId, updatedAt: now } });
      for (const trainingId of trainingIds) await upsertAssignment({ learnerId, trainingId, trainerId });
      const accessUrl = learnerAccessUrl(request.url, env.NEXT_PUBLIC_SITE_URL);
      const emailContent = learnerAccessEmail({ firstName, accessUrl });
      const sent = body.sendEmail === true && await sendTransactionalEmail({ to: email, ...emailContent });
      await audit(actor.id, 'learner.created', 'user', learnerId, { trainingIds, trainerId, sent }, request);
      return jsonOk({ learnerId, accessUrl, sent, message: sent ? 'Le compte apprenant est prêt et son lien permanent a été envoyé.' : existing ? 'Le compte existant a été rattaché aux parcours.' : 'Le compte apprenant est prêt.' }, existing ? 200 : 201);
    }
    const token = randomToken(32);
    const expiresAt = Math.floor(Date.now() / 1000) + Math.min(30, Math.max(1, Number(body.expiresInDays) || 7)) * 86_400;
    const invitationId = crypto.randomUUID();
    await getDb().insert(learnerInvitations).values({ id: invitationId, email, firstName, lastName, organization, groupName, assignedTrainerId: trainerId, trainingIdsJson: JSON.stringify(trainingIds), tokenHash: await sha256(token), expiresAt, createdBy: actor.id });
    const inviteUrl = new URL(`/invite/${token}`, request.url).toString();
    const accessUrl = learnerAccessUrl(request.url, env.NEXT_PUBLIC_SITE_URL);
    const invitationDays = Math.ceil((expiresAt - Date.now() / 1000) / 86400);
    const emailContent = learnerAccessEmail({ firstName, accessUrl, invitationUrl: inviteUrl, invitationDays });
    let sent = false;
    if (body.sendEmail === true) sent = await sendTransactionalEmail({ to: email, ...emailContent });
    await audit(actor.id, 'learner.invited', 'learner_invitation', invitationId, { trainerId, trainingIds, sent }, request);
    return jsonOk({ invitationId, inviteUrl, accessUrl, expiresAt, sent, message: sent ? 'Invitation et lien permanent envoyés.' : 'Invitation créée. Copiez le lien sécurisé.' }, 201);
  } catch (error) { return jsonError(error); }
}
