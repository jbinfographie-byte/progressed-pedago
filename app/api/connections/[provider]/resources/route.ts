import { requirePermission } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { listProviderResources, normalizeOAuthProvider } from '@/lib/provider-connections';

export async function GET(_request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const user = await requirePermission('manageResources'); const provider = normalizeOAuthProvider((await context.params).provider);
    return jsonOk({ resources: await listProviderResources(user.id, provider) });
  } catch (error) { return jsonError(error); }
}
