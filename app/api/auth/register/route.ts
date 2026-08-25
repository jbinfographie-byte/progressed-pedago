import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { trainerAccessRequests, users } from '@/db/schema';
import { getInitialAdminEligibility } from '@/lib/admin-bootstrap';
import { audit, createSession } from '@/lib/auth';
import { assertSameOrigin, cleanEmail, jsonError, jsonOk, readJson, AppError } from '@/lib/http';
import { hashPassword, validatePassword } from '@/lib/security';
import { migrateLegacyData } from '@/lib/legacy-migration';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const password = String(body.password ?? '');
    if (body.passwordConfirmation !== undefined && password !== String(body.passwordConfirmation)) throw new AppError(400, 'Les deux mots de passe ne correspondent pas.', 'PASSWORD_MISMATCH');
    const errors = validatePassword(password);
    if (errors.length) throw new AppError(400, errors.join(' '), 'WEAK_PASSWORD');
    const existing = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) throw new AppError(409, 'Un compte existe déjà avec cette adresse e-mail.', 'EMAIL_EXISTS');
    const adminExists = (await getDb().select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1)).length > 0;
    const adminEligibility = getInitialAdminEligibility({
      email,
      configuredEmail: env.INITIAL_ADMIN_EMAIL,
      adminExists,
      platformUserId: request.headers.get('oai-authenticated-user-id'),
      platformEmail: request.headers.get('oai-authenticated-user-email'),
      submittedToken: String(body.bootstrapToken ?? ''),
      configuredToken: env.INITIAL_ADMIN_BOOTSTRAP_TOKEN,
    });
    if (adminEligibility.wantsAdmin && !adminEligibility.allowed) {
      if (adminEligibility.reason === 'already_initialized') throw new AppError(409, 'Le compte administrateur initial a déjà été créé. Utilisez la connexion ou la récupération du mot de passe.', 'ADMIN_ALREADY_INITIALIZED');
      throw new AppError(403, 'Connectez-vous d’abord avec le compte sécurisé associé à cette adresse e-mail, puis réessayez.', 'ADMIN_IDENTITY_REQUIRED');
    }
    const adminAllowed = adminEligibility.allowed;
    const id = crypto.randomUUID();
    const passwordData = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    await getDb().batch([
      getDb().insert(users).values({ id, email, displayName: String(body.displayName ?? '').trim().slice(0, 100) || null, passwordHash: passwordData.hash, passwordSalt: passwordData.salt, role: adminAllowed ? 'admin' : 'trainer', status: adminAllowed ? 'active' : 'pending', activatedAt: adminAllowed ? now : null }),
      getDb().insert(trainerAccessRequests).values({ id: crypto.randomUUID(), trainerId: id, status: adminAllowed ? 'approved' : 'pending', decidedAt: adminAllowed ? now : null }),
    ]);
    let legacy = { activities:0,results:0 };
    if (adminAllowed) { try { legacy = await migrateLegacyData(id); } catch (error) { console.error('Reprise des données historiques différée',error instanceof Error ? error.message : 'erreur inconnue'); } }
    await audit(id, adminAllowed ? 'admin.bootstrap' : 'trainer.requested_access', 'user', id, { legacy, method: adminEligibility.method }, request);
    if (adminAllowed) await createSession(id, request);
    return jsonOk({ status: adminAllowed ? 'active' : 'pending', message: adminAllowed ? 'Votre compte administrateur est prêt. Vous avez maintenant accès à toute l’administration.' : 'Votre demande d’accès a été enregistrée. L’administrateur pourra maintenant vous autoriser.' }, 201);
  } catch (error) { return jsonError(error); }
}
