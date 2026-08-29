import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { providerConnections } from '@/db/schema';
import { AppError } from '@/lib/app-error';
import { decryptSecret, encryptSecret, randomToken } from '@/lib/security';

export const OAUTH_PROVIDERS = ['microsoft', 'google', 'canva'] as const;
export type OAuthProvider = typeof OAUTH_PROVIDERS[number];

type ProviderConfig = {
  provider: OAuthProvider;
  label: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
};

export type ProviderResource = {
  externalId: string;
  name: string;
  url: string;
  resourceType: 'presentation' | 'document';
  thumbnailUrl?: string;
  editUrl?: string;
  provider: OAuthProvider;
  metadata?: Record<string, unknown>;
};

export function normalizeOAuthProvider(value: unknown): OAuthProvider {
  if (value === 'microsoft' || value === 'google' || value === 'canva') return value;
  throw new AppError(404, 'Cette application n’est pas disponible.', 'PROVIDER_NOT_FOUND');
}

export function providerConfig(provider: OAuthProvider, origin: string): ProviderConfig {
  const base = String(env.NEXT_PUBLIC_SITE_URL ?? origin).replace(/\/$/, '');
  if (provider === 'microsoft') return {
    provider,
    label: 'Microsoft 365',
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['offline_access', 'User.Read', 'Files.Read'],
    redirectUri: `${base}/api/connections/microsoft/callback`,
  };
  if (provider === 'google') return {
    provider,
    label: 'Google Drive et Slides',
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'],
    redirectUri: `${base}/api/connections/google/callback`,
  };
  return {
    provider,
    label: 'Canva',
    clientId: env.CANVA_CLIENT_ID,
    clientSecret: env.CANVA_CLIENT_SECRET,
    authorizeUrl: 'https://www.canva.com/api/oauth/authorize',
    tokenUrl: 'https://api.canva.com/rest/v1/oauth/token',
    scopes: ['design:meta:read', 'profile:read'],
    redirectUri: `${base}/api/connections/canva/callback`,
  };
}

export function assertProviderConfigured(config: ProviderConfig) {
  if (!config.clientId || !config.clientSecret) {
    throw new AppError(503, `${config.label} doit d’abord être configuré par l’administrateur. L’interface n’affiche aucune fausse connexion.`, 'PROVIDER_CONFIGURATION_REQUIRED');
  }
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function buildAuthorizationUrl(config: ProviderConfig, state: string, challenge: string): string {
  assertProviderConfigured(config);
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId!);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', config.provider === 'canva' ? 's256' : 'S256');
  if (config.provider === 'microsoft') url.searchParams.set('response_mode', 'query');
  if (config.provider === 'google') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
  }
  return url.toString();
}

export async function exchangeAuthorizationCode(config: ProviderConfig, code: string, verifier: string) {
  assertProviderConfigured(config);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code,
    code_verifier: verifier,
  });
  if(config.provider!=='canva'){body.set('client_id',config.clientId!);body.set('client_secret',config.clientSecret!);}
  const headers:Record<string,string>={ 'Content-Type': 'application/x-www-form-urlencoded' };
  if(config.provider==='canva')headers.Authorization=`Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== 'string') throw new AppError(502, `La connexion ${config.label} a été refusée. Recommencez l’autorisation.`, 'PROVIDER_TOKEN_EXCHANGE_FAILED');
  return tokenPayload(payload, config.scopes);
}

export async function saveProviderConnection(trainerId: string, provider: OAuthProvider, payload: ReturnType<typeof tokenPayload>) {
  const now = Math.floor(Date.now() / 1000);
  const access = await encryptSecret(payload.accessToken, env.MASTER_ENCRYPTION_KEY);
  const refresh = payload.refreshToken ? await encryptSecret(payload.refreshToken, env.MASTER_ENCRYPTION_KEY) : null;
  const accountLabel = await providerAccountLabel(provider, payload.accessToken).catch(() => providerConfig(provider, '').label);
  await getDb().insert(providerConnections).values({
    id: crypto.randomUUID(), trainerId, provider, status: 'connected', accountLabel,
    accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv,
    refreshTokenCiphertext: refresh?.ciphertext ?? null, refreshTokenIv: refresh?.iv ?? null,
    scopesJson: JSON.stringify(payload.scopes), expiresAt: payload.expiresAt, lastTestedAt: now, createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({ target: [providerConnections.trainerId, providerConnections.provider], set: {
    status: 'connected', accountLabel, accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv,
    refreshTokenCiphertext: refresh?.ciphertext ?? null, refreshTokenIv: refresh?.iv ?? null,
    scopesJson: JSON.stringify(payload.scopes), expiresAt: payload.expiresAt, lastTestedAt: now, updatedAt: now,
  } });
}

export async function providerAccessToken(trainerId: string, provider: OAuthProvider): Promise<string> {
  const connection = (await getDb().select().from(providerConnections).where(and(eq(providerConnections.trainerId, trainerId), eq(providerConnections.provider, provider), eq(providerConnections.status, 'connected'))).limit(1))[0];
  if (!connection) throw new AppError(409, `Connectez d’abord ${providerConfig(provider, '').label}.`, 'PROVIDER_NOT_CONNECTED');
  const now = Math.floor(Date.now() / 1000);
  if (!connection.expiresAt || connection.expiresAt > now + 90) return decryptSecret(connection.accessTokenCiphertext, connection.accessTokenIv, env.MASTER_ENCRYPTION_KEY);
  if (!connection.refreshTokenCiphertext || !connection.refreshTokenIv) throw new AppError(401, 'Cette connexion a expiré. Reconnectez votre compte.', 'PROVIDER_RECONNECT_REQUIRED');
  const config = providerConfig(provider, '');
  assertProviderConfigured(config);
  const refreshToken = await decryptSecret(connection.refreshTokenCiphertext, connection.refreshTokenIv, env.MASTER_ENCRYPTION_KEY);
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  if(provider!=='canva'){body.set('client_id',config.clientId!);body.set('client_secret',config.clientSecret!);}
  if (provider === 'microsoft') body.set('scope', config.scopes.join(' '));
  const headers:Record<string,string>={ 'Content-Type': 'application/x-www-form-urlencoded' };if(provider==='canva')headers.Authorization=`Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;
  const response = await fetch(config.tokenUrl, { method: 'POST', headers, body });
  const raw = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof raw.access_token !== 'string') {
    await getDb().update(providerConnections).set({ status: 'error', updatedAt: now }).where(eq(providerConnections.id, connection.id));
    throw new AppError(401, 'La connexion a expiré et doit être renouvelée.', 'PROVIDER_REFRESH_FAILED');
  }
  await saveProviderConnection(trainerId, provider, tokenPayload(raw, JSON.parse(connection.scopesJson) as string[], refreshToken));
  return String(raw.access_token);
}

export async function listProviderResources(trainerId: string, provider: OAuthProvider): Promise<ProviderResource[]> {
  const token = await providerAccessToken(trainerId, provider);
  if (provider === 'microsoft') {
    const query = new URL('https://graph.microsoft.com/v1.0/me/drive/root/search(q=.pptx)');
    query.searchParams.set('$select', 'id,name,webUrl,size,file,lastModifiedDateTime');
    query.searchParams.set('$top', '50');
    const payload = await providerJson(query, token) as { value?: Array<Record<string, unknown>> };
    return (payload.value ?? []).filter((item) => String(item.name ?? '').toLowerCase().endsWith('.pptx')).map((item) => ({ externalId: String(item.id), name: String(item.name), url: String(item.webUrl), resourceType: 'presentation', provider, metadata: { size: item.size, modifiedAt: item.lastModifiedDateTime } }));
  }
  if (provider === 'google') {
    const query = new URL('https://www.googleapis.com/drive/v3/files');
    query.searchParams.set('q', "trashed=false and (mimeType='application/vnd.google-apps.presentation' or mimeType='application/vnd.openxmlformats-officedocument.presentationml.presentation' or mimeType='application/pdf')");
    query.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,size)');
    query.searchParams.set('orderBy', 'modifiedTime desc');
    query.searchParams.set('pageSize', '50');
    const payload = await providerJson(query, token) as { files?: Array<Record<string, unknown>> };
    return (payload.files ?? []).map((item) => ({ externalId: String(item.id), name: String(item.name), url: String(item.webViewLink), resourceType: String(item.mimeType).includes('presentation') ? 'presentation' : 'document', thumbnailUrl: typeof item.thumbnailLink === 'string' ? item.thumbnailLink : undefined, provider, metadata: { mimeType: item.mimeType, size: item.size, modifiedAt: item.modifiedTime } }));
  }
  const query = new URL('https://api.canva.com/rest/v1/designs');
  query.searchParams.set('limit', '50');
  query.searchParams.set('sort_by', 'modified_descending');
  const payload = await providerJson(query, token) as { items?: Array<Record<string, unknown>> };
  return (payload.items ?? []).map((item) => {
    const urls = (item.urls ?? {}) as Record<string, unknown>; const thumbnail = (item.thumbnail ?? {}) as Record<string, unknown>;
    return { externalId: String(item.id), name: String(item.title ?? 'Création Canva'), url: String(urls.view_url ?? urls.edit_url), editUrl: typeof urls.edit_url === 'string' ? urls.edit_url : undefined, resourceType: 'presentation', thumbnailUrl: typeof thumbnail.url === 'string' ? thumbnail.url : undefined, provider, metadata: { pageCount: item.page_count, designTypes: item.design_types } };
  });
}

export async function testProviderConnection(trainerId: string, provider: OAuthProvider): Promise<string> {
  const resources = await listProviderResources(trainerId, provider);
  const now = Math.floor(Date.now() / 1000);
  await getDb().update(providerConnections).set({ status: 'connected', lastTestedAt: now, updatedAt: now }).where(and(eq(providerConnections.trainerId, trainerId), eq(providerConnections.provider, provider)));
  return `${providerConfig(provider, '').label} répond correctement · ${resources.length} ressource(s) accessible(s).`;
}

export function newVerifier() { return randomToken(64); }

function tokenPayload(raw: Record<string, unknown>, fallbackScopes: string[], fallbackRefresh = '') {
  const expiresIn = Math.max(60, Number(raw.expires_in) || 3600);
  return {
    accessToken: String(raw.access_token),
    refreshToken: typeof raw.refresh_token === 'string' ? raw.refresh_token : fallbackRefresh,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    scopes: typeof raw.scope === 'string' ? raw.scope.split(/\s+/).filter(Boolean) : fallbackScopes,
  };
}

async function providerAccountLabel(provider: OAuthProvider, token: string): Promise<string> {
  if (provider === 'microsoft') { const value = await providerJson(new URL('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName'), token) as Record<string, unknown>; return String(value.displayName ?? value.mail ?? value.userPrincipalName ?? 'Compte Microsoft'); }
  if (provider === 'google') { const value = await providerJson(new URL('https://openidconnect.googleapis.com/v1/userinfo'), token) as Record<string, unknown>; return String(value.name ?? value.email ?? 'Compte Google'); }
  return 'Compte Canva';
}

async function providerJson(url: URL, token: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!response.ok) throw new AppError(response.status === 401 ? 401 : 502, 'Le service extérieur ne répond pas avec les autorisations attendues.', 'PROVIDER_API_FAILED');
  return response.json();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
