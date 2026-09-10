import { audit, requirePermission } from '@/lib/auth';
import { assertSameOrigin, jsonError, jsonOk } from '@/lib/http';
import { normalizeOAuthProvider, testProviderConnection } from '@/lib/provider-connections';

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    assertSameOrigin(request); const user = await requirePermission('manageResources'); const provider = normalizeOAuthProvider((await context.params).provider);
    const message = await testProviderConnection(user.id, provider); await audit(user.id, 'provider.tested', 'provider_connection', provider, {}, request);
    return jsonOk({ message });
  } catch (error) { return jsonError(error); }
}
