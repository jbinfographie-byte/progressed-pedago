import { env } from 'cloudflare:workers';
import { and, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { oauthAuthorizations } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { decryptSecret, sha256 } from '@/lib/security';
import { exchangeAuthorizationCode, normalizeOAuthProvider, providerConfig, saveProviderConnection } from '@/lib/provider-connections';

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const origin = new URL(request.url).origin; const provider = normalizeOAuthProvider((await context.params).provider);
  try {
    const user = await requirePermission('manageResources'); const params = new URL(request.url).searchParams; const state = params.get('state') ?? ''; const code = params.get('code') ?? '';
    if (!state || !code || params.get('error')) throw new Error('authorization_denied');
    const now = Math.floor(Date.now() / 1000); const stateHash = await sha256(`${state}${env.SECURITY_PEPPER}`);
    const authorization = (await getDb().select().from(oauthAuthorizations).where(and(eq(oauthAuthorizations.trainerId, user.id), eq(oauthAuthorizations.provider, provider), eq(oauthAuthorizations.stateHash, stateHash), gt(oauthAuthorizations.expiresAt, now))).limit(1))[0];
    if (!authorization) throw new Error('invalid_state');
    const verifier = await decryptSecret(authorization.verifierCiphertext, authorization.verifierIv, env.MASTER_ENCRYPTION_KEY);
    const payload = await exchangeAuthorizationCode(providerConfig(provider, origin), code, verifier);
    await saveProviderConnection(user.id, provider, payload);
    await getDb().delete(oauthAuthorizations).where(eq(oauthAuthorizations.id, authorization.id));
    await audit(user.id, 'provider.connected', 'provider_connection', provider, {}, request);
    return NextResponse.redirect(new URL('/?view=connections&connection=success', origin));
  } catch {
    return NextResponse.redirect(new URL('/?view=connections&connection=failed', origin));
  }
}
