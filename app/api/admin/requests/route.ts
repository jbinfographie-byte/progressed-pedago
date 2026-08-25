import { env } from 'cloudflare:workers';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activationCodes, trainerAccessRequests, users } from '@/db/schema';
import { audit, requireAdmin } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { randomToken, sha256 } from '@/lib/security';

export async function GET() {
  try {
    await requireAdmin();
    const rows = await getDb().select({ id: trainerAccessRequests.id, status: trainerAccessRequests.status, requestedAt: trainerAccessRequests.requestedAt, trainerId: users.id, email: users.email, displayName: users.displayName, accountStatus: users.status })
      .from(trainerAccessRequests).innerJoin(users, eq(trainerAccessRequests.trainerId, users.id)).orderBy(desc(trainerAccessRequests.requestedAt));
    return jsonOk({ requests: rows });
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
    if (action === 'approve') {
      const providedCode = String(body.code ?? '').trim().toUpperCase();
      const code = providedCode || `PEDAGO-${randomToken(6).slice(0, 4).toUpperCase()}-${randomToken(6).slice(0, 4).toUpperCase()}`;
      if (!/^[A-Z0-9-]{8,32}$/.test(code)) throw new AppError(400, 'Le code doit contenir 8 à 32 lettres, chiffres ou tirets.', 'INVALID_CODE');
      const expiresAt = now + 72 * 60 * 60;
      await getDb().batch([
        getDb().insert(activationCodes).values({ id: crypto.randomUUID(), trainerId, codeHash: await sha256(`${code}${env.SECURITY_PEPPER}`), expiresAt, createdBy: admin.id }),
        getDb().update(trainerAccessRequests).set({ status: 'approved', decidedAt: now, decidedBy: admin.id }).where(eq(trainerAccessRequests.trainerId, trainerId)),
      ]);
      const subject = 'Votre accès à Progressed Pédago';
      const message = `Bonjour${trainer.displayName ? ` ${trainer.displayName}` : ''},\n\nVotre demande d’accès à Progressed Pédago est acceptée.\n\nCode d’activation : ${code}\nCe code est valable 72 heures.\n\nÀ bientôt,\nProgressed Solution`;
      const mailto = `mailto:${encodeURIComponent(trainer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      let sent = false;
      if (body.sendEmail === true && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [trainer.email], subject, text: message }) });
        sent = response.ok;
      }
      await audit(admin.id, 'admin.approved_trainer', 'user', trainerId, { sent }, request);
      return jsonOk({ code, expiresAt, mailto, sent, message: sent ? 'Autorisation envoyée.' : 'Autorisation préparée. Le lien e-mail est prêt.' });
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
