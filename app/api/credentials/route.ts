import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { encryptedApiCredentials } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { encryptSecret } from '@/lib/security';
import { safeOpenAiModel } from '@/lib/ai-security';

export async function GET() {
  try {
    const user = await requirePermission('manageAiConnection');
    const credential = (await getDb().select({ lastFour: encryptedApiCredentials.lastFour, model: encryptedApiCredentials.model, validatedAt: encryptedApiCredentials.validatedAt }).from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, user.id)).limit(1))[0];
    return jsonOk({ connected: Boolean(credential || env.OPENAI_API_KEY), connectionMode: credential ? 'personal' : env.OPENAI_API_KEY ? 'platform' : 'none', credential: credential ?? null });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requirePermission('manageAiConnection');
    const body = await readJson(request);
    const apiKey = String(body.apiKey ?? '').trim();
    const model = safeOpenAiModel(body.model);
    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new AppError(400, 'La clé OpenAI ne présente pas un format valide.', 'INVALID_API_KEY_FORMAT');
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: 'Réponds uniquement par OK.', max_output_tokens: 16, store: false }) });
    if (!response.ok) {
      let code = ''; try { code = String(((await response.json()) as { error?: { code?: string } }).error?.code ?? ''); } catch { /* réponse non JSON */ }
      if (response.status === 401) throw new AppError(400, 'Cette clé OpenAI est invalide ou révoquée.', 'OPENAI_INVALID_KEY');
      if (response.status === 429 || code.includes('quota')) throw new AppError(400, 'Le quota OpenAI est dépassé ou la facturation du compte n’est pas active.', 'OPENAI_QUOTA');
      if (response.status === 403) throw new AppError(400, 'Ce compte OpenAI n’autorise pas l’utilisation de ce modèle. Vérifiez la facturation et les droits du projet.', 'OPENAI_FORBIDDEN');
      throw new AppError(503, 'OpenAI est momentanément indisponible. Réessayez plus tard.', 'OPENAI_UNAVAILABLE');
    }
    const encrypted = await encryptSecret(apiKey, env.MASTER_ENCRYPTION_KEY);
    const now = Math.floor(Date.now() / 1000);
    await getDb().insert(encryptedApiCredentials).values({ id: crypto.randomUUID(), trainerId: user.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, lastFour: apiKey.slice(-4), model, validatedAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: encryptedApiCredentials.trainerId, set: { ciphertext: encrypted.ciphertext, iv: encrypted.iv, lastFour: apiKey.slice(-4), model, validatedAt: now, updatedAt: now } });
    await audit(user.id, 'credential.connected', 'openai_credential', null, { model }, request);
    return jsonOk({ message: 'Connexion validée', lastFour: apiKey.slice(-4), model });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); const user = await requirePermission('manageAiConnection'); await getDb().delete(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, user.id)); await audit(user.id, 'credential.deleted', 'openai_credential', null, {}, request); return jsonOk({ message: 'La clé OpenAI a été supprimée.' }); } catch (error) { return jsonError(error); }
}
