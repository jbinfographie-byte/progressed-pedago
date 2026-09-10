import { env } from 'cloudflare:workers';
import { lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { oauthAuthorizations } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { assertSameOrigin, jsonError, jsonOk } from '@/lib/http';
import { buildAuthorizationUrl, newVerifier, normalizeOAuthProvider, pkceChallenge, providerConfig } from '@/lib/provider-connections';
import { encryptSecret, randomToken, sha256 } from '@/lib/security';

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    assertSameOrigin(request); const user = await requirePermission('manageResources'); const provider = normalizeOAuthProvider((await context.params).provider);
    const now = Math.floor(Date.now() / 1000); const state = randomToken(48); const verifier = newVerifier(); const encrypted = await encryptSecret(verifier, env.MASTER_ENCRYPTION_KEY);
    await getDb().delete(oauthAuthorizations).where(lt(oauthAuthorizations.expiresAt, now));
    await getDb().insert(oauthAuthorizations).values({ id: crypto.randomUUID(), trainerId: user.id, provider, stateHash: await sha256(`${state}${env.SECURITY_PEPPER}`), verifierCiphertext: encrypted.ciphertext, verifierIv: encrypted.iv, returnTo: '/?view=connections', expiresAt: now + 600, createdAt: now });
    const config = providerConfig(provider, new URL(request.url).origin);
    return jsonOk({ authorizationUrl: buildAuthorizationUrl(config, state, await pkceChallenge(verifier)) });
  } catch (error) { return jsonError(error); }
}
