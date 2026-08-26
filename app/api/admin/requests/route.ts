import { env } from 'cloudflare:workers';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { trainerAccessRequests, trainerPermissions, users } from '@/db/schema';
import { audit, requireAdmin } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { detectPermissionLevel, normalizePermissions, PERMISSION_KEYS } from '@/lib/permissions';

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
      accessLevel: trainerPermissions.accessLevel,
      permissionsJson: trainerPermissions.permissionsJson,
    }).from(trainerAccessRequests)
      .innerJoin(users, eq(trainerAccessRequests.trainerId, users.id))
      .leftJoin(trainerPermissions, eq(trainerPermissions.trainerId, users.id))
      .where(eq(users.role, 'trainer'))
      .orderBy(desc(trainerAccessRequests.requestedAt));
    return jsonOk({ requests: rows.map(({ permissionsJson, accessLevel, ...row }) => {
      const permissions = normalizePermissions(permissionsJson);
      return { ...row, accessLevel: accessLevel ?? detectPermissionLevel(permissions), permissions };
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
      await getDb().batch([
        getDb().update(trainerAccessRequests).set({ status: 'approved', decidedAt: now, decidedBy: admin.id }).where(eq(trainerAccessRequests.trainerId, trainerId)),
        getDb().update(users).set({ status: 'active', activatedAt: now, updatedAt: now }).where(eq(users.id, trainerId)),
      ]);
      const subject = 'Votre accès à Progressed Pédago';
      const message = `Bonjour${trainer.displayName ? ` ${trainer.displayName}` : ''},\n\nVotre demande d’accès à Progressed Pédago est acceptée. Vous pouvez maintenant vous connecter avec votre adresse e-mail et le mot de passe choisi lors de votre inscription.\n\nAucun code supplémentaire n’est nécessaire.\n\nÀ bientôt,\nProgressed Solution`;
      const mailto = `mailto:${encodeURIComponent(trainer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      let sent = false;
      if (body.sendEmail === true && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [trainer.email], subject, text: message }) });
        sent = response.ok;
      }
      await audit(admin.id, 'admin.approved_trainer', 'user', trainerId, { sent }, request);
      return jsonOk({ mailto, sent, message: sent ? 'Compte autorisé et e-mail envoyé.' : 'Compte autorisé. Le formateur peut se connecter immédiatement.' });
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
    throw new AppError(400, 'Action administrateur inconnue.', 'INVALID_ACTION');
  } catch (error) { return jsonError(error); }
}
