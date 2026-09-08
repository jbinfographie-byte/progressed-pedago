import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { appSettings, encryptedApiCredentials } from '@/db/schema';
import { AppError, readJson } from '@/lib/http';
import { decryptSecret } from '@/lib/security';
import { AI_SECURITY_DEFAULTS, normalizeAiSecuritySettings, safeOpenAiModel, type AiSecuritySettings } from '@/lib/ai-security-policy';
export { AI_SECURITY_DEFAULTS, safeOpenAiModel } from '@/lib/ai-security-policy';

export async function getAiSecuritySettings(): Promise<AiSecuritySettings> {
  const row = (await getDb().select({ valueJson: appSettings.valueJson }).from(appSettings).where(eq(appSettings.key, 'ai_security')).limit(1))[0];
  if (!row) return AI_SECURITY_DEFAULTS;
  try {
    return normalizeAiSecuritySettings(JSON.parse(row.valueJson) as Partial<AiSecuritySettings>);
  } catch { return AI_SECURITY_DEFAULTS; }
}

export async function resolveOpenAiCredential(trainerId: string): Promise<{ apiKey: string; model: string; source: 'personal' | 'platform' }> {
  const credential = (await getDb().select().from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, trainerId)).limit(1))[0];
  if (credential) return { apiKey: await decryptSecret(credential.ciphertext, credential.iv, env.MASTER_ENCRYPTION_KEY), model: safeOpenAiModel(credential.model,env.OPENAI_MODEL), source: 'personal' };
  if (env.OPENAI_API_KEY) return { apiKey: env.OPENAI_API_KEY, model: safeOpenAiModel(env.OPENAI_MODEL), source: 'platform' };
  throw new AppError(409, 'Aucune connexion IA sécurisée n’est disponible. Contactez l’administrateur.', 'OPENAI_NOT_CONNECTED');
}

export async function readAiJson(request: Request): Promise<Record<string, unknown>> {
  const settings = await getAiSecuritySettings();
  return readJson(request, settings.maxJsonBytes);
}
