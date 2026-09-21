import { env } from '@/lib/runtime-env';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { activationCodes, subscriptionPlans, trainerAccessRequests, trainerPermissions, userSubscriptions, users } from '@/db/schema';
import { generateTrainerAccessCode, trainerAccessCodeHint } from '@/lib/access-codes';
import { audit, requireAdmin } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { detectPermissionLevel, normalizePermissions, PERMISSION_KEYS } from '@/lib/permissions';
import { sha256 } from '@/lib/security';

export async function GET() {
  try {
    await requireAdmin();
    const rows = await getDb().select({
      id: trainerAccessRequests.id,
      status: trainerAccessRequests.status,
      requestedAt: trainerAccessRequests.requestedAt,
      trainerId: users.id,
      email: users.email,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      accountStatus: users.status,
      note: trainerAccessRequests.note,
      accessLevel: trainerPermissions.accessLevel,
      permissionsJson: trainerPermissions.permissionsJson,
      planId: userSubscriptions.planId,
      planName: subscriptionPlans.name,
      subscriptionStatus: userSubscriptions.status,
    }).from(trainerAccessRequests)
      .innerJoin(users, eq(trainerAccessRequests.trainerId, users.id))
      .leftJoin(trainerPermissions, eq(trainerPermissions.trainerId, users.id))
      .leftJoin(userSubscriptions, eq(userSubscriptions.userId, users.id))
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, userSubscriptions.planId))
      .where(eq(users.role, 'trainer'))
      .orderBy(desc(trainerAccessRequests.requestedAt));
    const codes = await getDb().select({ trainerId: activationCodes.trainerId, codeHint: activationCodes.codeHint, expiresAt: activationCodes.expiresAt, usedAt: activationCodes.usedAt, createdAt: activationCodes.createdAt }).from(activationCodes).orderBy(desc(activationCodes.createdAt));
    const latestCode = new Map<string,(typeof codes)[number]>();
    for (const code of codes) if (!latestCode.has(code.trainerId)) latestCode.set(code.trainerId, code);
    return jsonOk({ requests: rows.map(({ permissionsJson, accessLevel, ...row }) => {
      const permissions = normalizePermissions(permissionsJson);
      const code = latestCode.get(row.trainerId);
      return { ...row, codeHint: code?.codeHint || null, codeExpiresAt: code?.expiresAt ?? null, codeUsedAt: code?.usedAt ?? null, accessLevel: accessLevel ?? detectPermissionLevel(permissions), permissions };
    }) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const body = await readJson(request);
    const trainerId = String(body.trainerId ?? '');
    const trainer = (await getDb().select().from(users).where(and(eq(users.id, trainerId), eq(users.role, 'trainer'))).limit(1))[0];
    if (!trainer) throw new AppError(404, 'Le compte formateur est introuvable.', 'TRAINER_NOT_FOUND');
    const action = String(body.action ?? '');
    const now = Math.floor(Date.now() / 1000);
    if (action === 'update_permissions') {
      const permissions = normalizePermissions(body.permissions);
      const accessLevel = detectPermissionLevel(permissions);
      await getDb().insert(trainerPermissions).values({ trainerId, permissionsJson: JSON.stringify(permissions), accessLevel, updatedBy: admin.id, updatedAt: now })
        .onConflictDoUpdate({ target: trainerPermissions.trainerId, set: { permissionsJson: JSON.stringify(permissions), accessLevel, updatedBy: admin.id, updatedAt: now } });
      await audit(admin.id, 'admin.updated_trainer_permissions', 'user', trainerId, { accessLevel, enabled: PERMISSION_KEYS.filter((permission) => permissions[permission]) }, request);
      const label = accessLevel === 'limited' ? 'limité' : accessLevel === 'medium' ? 'moyen' : accessLevel === 'extended' ? 'étendu' : 'personnalisé';
      return jsonOk({ message: `Droits enregistrés : profil ${label}.`, accessLevel, permissions });
    }
    if (action === 'approve') {
      const code = generateTrainerAccessCode();
      const codeHash = await sha256(`${code}${env.SECURITY_PEPPER}`);
      const expiresAt = now + 7 * 24 * 60 * 60;
      await getDb().batch([
        getDb().update(activationCodes).set({ usedAt: now }).where(and(eq(activationCodes.trainerId, trainerId), isNull(activationCodes.usedAt))),
        getDb().insert(activationCodes).values({ id: crypto.randomUUID(), trainerId, codeHash, codeHint: trainerAccessCodeHint(code), expiresAt, createdBy: admin.id }),
        getDb().update(trainerAccessRequests).set({ status: 'pending', decidedAt: now, decidedBy: admin.id }).where(eq(trainerAccessRequests.trainerId, trainerId)),
        getDb().update(users).set({ status: 'pending', activatedAt: null, updatedAt: now }).where(eq(users.id, trainerId)),
      ]);
      const subject = 'Votre code d’accès à Progressed Pédago';
      const message = `Bonjour${trainer.displayName ? ` ${trainer.displayName}` : ''},\n\nVotre demande d’accès à Progressed Pédago est acceptée.\n\nVotre code d’accès temporaire est : ${code}\n\nSur la page d’accueil, choisissez « J’ai reçu mon code », puis saisissez votre adresse e-mail et ce code. Il expire dans 7 jours. Votre mot de passe reste celui choisi lors de l’inscription.\n\nÀ bientôt,\nProgressed Solution`;
      const mailto = `mailto:${encodeURIComponent(trainer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      let sent = false;
      if (body.sendEmail === true && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [trainer.email], subject, text: message }) });
        sent = response.ok;
      }
      await audit(admin.id, 'admin.issued_trainer_code', 'user', trainerId, { sent, expiresAt }, request);
      return jsonOk({ code, codeHint: trainerAccessCodeHint(code), expiresAt, mailto, sent, message: sent ? 'Code créé et envoyé au formateur.' : 'Code créé. Copiez-le maintenant ou utilisez le message préparé.' });
    }
    const accountStatus = action === 'suspend' ? 'suspended' : action === 'reactivate' ? 'active' : action === 'revoke' ? 'revoked' : null;
    if (accountStatus) {
      await getDb().update(users).set({ status: accountStatus, updatedAt: now }).where(eq(users.id, trainerId));
      await audit(admin.id, `admin.${action}_trainer`, 'user', trainerId, {}, request);
      return jsonOk({ message: accountStatus === 'active' ? 'Compte réactivé.' : accountStatus === 'suspended' ? 'Compte suspendu.' : 'Accès révoqué.' });
    }
    if (action === 'refuse') {
      await getDb().batch([
        getDb().update(trainerAccessRequests).set({ status: 'refused', note: String(body.note ?? '').slice(0, 500), decidedAt: now, decidedBy: admin.id }).where(eq(trainerAccessRequests.trainerId, trainerId)),
        getDb().update(users).set({ status: 'revoked', updatedAt: now }).where(eq(users.id, trainerId)),
      ]);
      await audit(admin.id, 'admin.refused_trainer', 'user', trainerId, {}, request);
      return jsonOk({ message: 'Demande refusée.' });
    }
    if (action === 'update_note') {
      const note = String(body.note ?? '').trim().slice(0, 500);
      await getDb().update(trainerAccessRequests).set({ note }).where(eq(trainerAccessRequests.trainerId, trainerId));
      await audit(admin.id, 'admin.updated_trainer_support_note', 'user', trainerId, {}, request);
      return jsonOk({ message: 'Note de suivi enregistrée.' });
    }
    throw new AppError(400, 'Action administrateur inconnue.', 'INVALID_ACTION');
  } catch (error) { return jsonError(error); }
}
