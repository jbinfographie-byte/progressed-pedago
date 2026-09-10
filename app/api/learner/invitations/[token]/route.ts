import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolders, learnerInvitations, learnerProfiles, users } from '@/db/schema';
import { audit, createSession } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { cleanTrainingIds, upsertAssignment } from '@/lib/learner-access';
import { hashPassword, sha256, validatePassword, verifyPassword } from '@/lib/security';

async function invitationFromToken(token: string) {
  const row = (await getDb().select().from(learnerInvitations).where(and(eq(learnerInvitations.tokenHash, await sha256(token)), eq(learnerInvitations.status, 'pending'), gt(learnerInvitations.expiresAt, Math.floor(Date.now() / 1000)))).limit(1))[0];
  if (!row) throw new AppError(404, 'Ce lien d’invitation est invalide, expiré ou déjà utilisé.', 'INVITATION_UNAVAILABLE');
  return row;
}

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const invitation = await invitationFromToken((await context.params).token);
    const trainings = await getDb().select({ id: courseFolders.id, name: courseFolders.name }).from(courseFolders);
    const selected = new Set(cleanTrainingIds(JSON.parse(invitation.trainingIdsJson)));
    return jsonOk({ invitation: { firstName: invitation.firstName, lastName: invitation.lastName, email: invitation.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'), organization: invitation.organization, groupName: invitation.groupName, expiresAt: invitation.expiresAt, existingAccount: Boolean((await getDb().select({ id: users.id }).from(users).where(eq(users.email, invitation.email)).limit(1))[0]), trainings: trainings.filter((item) => selected.has(item.id)) } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const token = (await context.params).token;
    const invitation = await invitationFromToken(token);
    const body = await readJson(request);
    if (body.privacyAccepted !== true) throw new AppError(400, 'Vous devez accepter les informations de confidentialité.', 'PRIVACY_REQUIRED');
    const password = String(body.password ?? '');
    const existing = (await getDb().select().from(users).where(eq(users.email, invitation.email)).limit(1))[0];
    if (existing && existing.role !== 'learner') throw new AppError(409, 'Cette adresse est déjà associée à un autre type de compte.', 'EMAIL_IN_USE');
    if (existing) {
      if (!(await verifyPassword(password, existing.passwordSalt, existing.passwordHash))) throw new AppError(401, 'Le mot de passe du compte existant est incorrect.', 'INVALID_CREDENTIALS');
      if (existing.status !== 'active') throw new AppError(403, 'Ce compte apprenant n’est pas actif. Contactez votre formateur.', 'ACCOUNT_UNAVAILABLE');
    } else {
      const errors = validatePassword(password);
      if (errors.length) throw new AppError(400, errors.join(' '), 'WEAK_PASSWORD');
    }
    const learnerId = existing?.id ?? crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    if (!existing) {
      const passwordData = await hashPassword(password);
      await getDb().insert(users).values({ id: learnerId, email: invitation.email, firstName: invitation.firstName, lastName: invitation.lastName, displayName: `${invitation.firstName} ${invitation.lastName}`, passwordHash: passwordData.hash, passwordSalt: passwordData.salt, role: 'learner', status: 'active', activatedAt: now });
    }
    await getDb().insert(learnerProfiles).values({ userId: learnerId, organization: invitation.organization, groupName: invitation.groupName, assignedTrainerId: invitation.assignedTrainerId, privacyAcceptedAt: now })
      .onConflictDoUpdate({ target: learnerProfiles.userId, set: { organization: invitation.organization, groupName: invitation.groupName, assignedTrainerId: invitation.assignedTrainerId, privacyAcceptedAt: now, updatedAt: now } });
    if (invitation.assignedTrainerId) for (const trainingId of cleanTrainingIds(JSON.parse(invitation.trainingIdsJson))) await upsertAssignment({ learnerId, trainingId, trainerId: invitation.assignedTrainerId });
    await getDb().update(learnerInvitations).set({ status: 'used', usedBy: learnerId, usedAt: now }).where(eq(learnerInvitations.id, invitation.id));
    await createSession(learnerId, request);
    await audit(learnerId, 'learner.invitation_accepted', 'learner_invitation', invitation.id, {}, request);
    return jsonOk({ message: 'Votre espace apprenant est prêt.', learnerId });
  } catch (error) { return jsonError(error); }
}
