import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { providerConnections } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { assertSameOrigin, jsonError, jsonOk } from '@/lib/http';
import { normalizeOAuthProvider } from '@/lib/provider-connections';

export async function DELETE(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    assertSameOrigin(request); const user = await requirePermission('manageResources'); const provider = normalizeOAuthProvider((await context.params).provider);
    await getDb().delete(providerConnections).where(and(eq(providerConnections.trainerId, user.id), eq(providerConnections.provider, provider)));
    await audit(user.id, 'provider.disconnected', 'provider_connection', provider, {}, request);
    return jsonOk({ message: 'La connexion a été supprimée immédiatement. Les ressources déjà liées restent enregistrées comme liens.' });
  } catch (error) { return jsonError(error); }
}
