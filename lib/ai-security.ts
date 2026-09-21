import { env } from 'cloudflare:workers';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { appSettings, encryptedApiCredentials, users } from '@/db/schema';
import { AppError, readJson } from '@/lib/http';
import { decryptSecret } from '@/lib/security';
import { AI_SECURITY_DEFAULTS, chooseOpenAiCredentialSource, normalizeAiSecuritySettings, safeOpenAiModel, type AiSecuritySettings, type OpenAiCredentialSource } from '@/lib/ai-security-policy';
export { AI_SECURITY_DEFAULTS, safeOpenAiModel } from '@/lib/ai-security-policy';

export async function getAiSecuritySettings(): Promise<AiSecuritySettings> {
  const row = (await getDb().select({ valueJson: appSettings.valueJson }).from(appSettings).where(eq(appSettings.key, 'ai_security')).limit(1))[0];
  if (!row) return AI_SECURITY_DEFAULTS;
  try {
    return normalizeAiSecuritySettings(JSON.parse(row.valueJson) as Partial<AiSecuritySettings>);
  } catch { return AI_SECURITY_DEFAULTS; }
}

async function activeAdministratorCredential() {
  return (await getDb().select({
    trainerId: encryptedApiCredentials.trainerId,
    ciphertext: encryptedApiCredentials.ciphertext,
    iv: encryptedApiCredentials.iv,
    model: encryptedApiCredentials.model,
    validatedAt: encryptedApiCredentials.validatedAt,
  }).from(encryptedApiCredentials)
    .innerJoin(users, eq(encryptedApiCredentials.trainerId, users.id))
    .where(and(eq(users.role, 'admin'), eq(users.status, 'active')))
    .orderBy(desc(encryptedApiCredentials.validatedAt), desc(encryptedApiCredentials.updatedAt))
    .limit(1))[0];
}

export async function getOpenAiConnectionOverview(trainerId: string) {
  const personal = (await getDb().select({
    lastFour: encryptedApiCredentials.lastFour,
    model: encryptedApiCredentials.model,
    validatedAt: encryptedApiCredentials.validatedAt,
  }).from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, trainerId)).limit(1))[0];
  const administrator = await activeAdministratorCredential();
  const source = chooseOpenAiCredentialSource({ hasPersonal: Boolean(personal), hasPlatform: Boolean(env.OPENAI_API_KEY), hasAdministrator: Boolean(administrator) });
  if (source === 'platform') return { connected: true, connectionMode: 'platform' as const, credential: null };
  if (source === 'administrator') {
    if (personal && administrator?.trainerId === trainerId) return { connected: true, connectionMode: 'personal' as const, credential: personal };
    return { connected: true, connectionMode: 'administrator' as const, credential: null };
  }
  if (source === 'personal') return { connected: true, connectionMode: 'personal' as const, credential: personal };
  return { connected: false, connectionMode: 'none' as const, credential: null };
}

export async function resolveOpenAiCredential(trainerId: string): Promise<{ apiKey: string; model: string; source: OpenAiCredentialSource }> {
  const personal = (await getDb().select().from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, trainerId)).limit(1))[0];
  const administrator = await activeAdministratorCredential();
  const source = chooseOpenAiCredentialSource({ hasPersonal: Boolean(personal), hasPlatform: Boolean(env.OPENAI_API_KEY), hasAdministrator: Boolean(administrator) });
  if (source === 'platform') return { apiKey: env.OPENAI_API_KEY!, model: safeOpenAiModel(env.OPENAI_MODEL), source };
  if (source === 'administrator' && administrator) return { apiKey: await decryptSecret(administrator.ciphertext, administrator.iv, env.MASTER_ENCRYPTION_KEY), model: safeOpenAiModel(administrator.model, env.OPENAI_MODEL), source };
  if (source === 'personal' && personal) return { apiKey: await decryptSecret(personal.ciphertext, personal.iv, env.MASTER_ENCRYPTION_KEY), model: safeOpenAiModel(personal.model, env.OPENAI_MODEL), source };
  throw new AppError(409, 'Aucune connexion IA sécurisée n’est disponible. Contactez l’administrateur.', 'OPENAI_NOT_CONNECTED');
}

export async function readAiJson(request: Request): Promise<Record<string, unknown>> {
  const settings = await getAiSecuritySettings();
  return readJson(request, settings.maxJsonBytes);
}
