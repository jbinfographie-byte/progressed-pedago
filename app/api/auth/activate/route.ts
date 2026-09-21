import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '@/lib/runtime-env';
import { getDb } from '@/db';
import { activationCodes, trainerAccessRequests, users } from '@/db/schema';
import { audit, createSession } from '@/lib/auth';
import { AppError, assertSameOrigin, cleanEmail, jsonError, jsonOk, readJson } from '@/lib/http';
import { sha256 } from '@/lib/security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const user = (await getDb().select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user) throw new AppError(400, 'Ce code ne correspond à aucune demande active.', 'INVALID_ACTIVATION');
    const codeHash = await sha256(`${String(body.code ?? '').trim().toUpperCase()}${env.SECURITY_PEPPER}`);
    const code = (await getDb().select().from(activationCodes).where(and(eq(activationCodes.trainerId, user.id), eq(activationCodes.codeHash, codeHash), gt(activationCodes.expiresAt, Math.floor(Date.now() / 1000)), isNull(activationCodes.usedAt))).limit(1))[0];
    if (!code) throw new AppError(400, 'Le code est invalide ou a expiré. Demandez un nouveau code.', 'INVALID_ACTIVATION');
    const now = Math.floor(Date.now() / 1000);
    await getDb().batch([
      getDb().update(activationCodes).set({ usedAt: now }).where(eq(activationCodes.id, code.id)),
      getDb().update(users).set({ status: 'active', activatedAt: now, updatedAt: now }).where(eq(users.id, user.id)),
      getDb().update(trainerAccessRequests).set({ status: 'approved', decidedAt: now }).where(eq(trainerAccessRequests.trainerId, user.id)),
    ]);
    await createSession(user.id, request);
    await audit(user.id, 'trainer.activated', 'user', user.id, {}, request);
    return jsonOk({ message: 'Votre compte est activé. Bienvenue dans Progressed Pédago.' });
  } catch (error) { return jsonError(error); }
}
