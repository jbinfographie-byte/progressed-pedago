import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { providerConnections } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { OAUTH_PROVIDERS, providerConfig } from '@/lib/provider-connections';

const requiredEnvironment: Record<string, string[]> = {
  microsoft: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  canva: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET'],
};

export async function GET(request: Request) {
  try {
    const user = await requirePermission('manageResources');
    const origin = new URL(request.url).origin;
    const rows = await getDb().select({ provider: providerConnections.provider, status: providerConnections.status, accountLabel: providerConnections.accountLabel, expiresAt: providerConnections.expiresAt, lastTestedAt: providerConnections.lastTestedAt }).from(providerConnections).where(eq(providerConnections.trainerId, user.id));
    const byProvider = new Map(rows.map((row) => [row.provider, row]));
    return jsonOk({ connections: OAUTH_PROVIDERS.map((provider) => {
      const config = providerConfig(provider, origin); const row = byProvider.get(provider);
      return {
        provider, label: config.label, configured: Boolean(config.clientId && config.clientSecret), connected: row?.status === 'connected', status: row?.status ?? 'disconnected',
        accountLabel: row?.accountLabel ?? '', expiresAt: row?.expiresAt ?? null, lastTestedAt: row?.lastTestedAt ?? null,
        redirectUri: config.redirectUri, scopes: config.scopes, requiredEnvironment: requiredEnvironment[provider],
      };
    }) });
  } catch (error) { return jsonError(error); }
}
