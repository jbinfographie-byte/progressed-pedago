import { assertPermission, requirePermission } from '@/lib/auth';
import { readAiJson } from '@/lib/ai-security';
import { assertSameOrigin, jsonError, jsonOk } from '@/lib/http';
import { resolveWordwallEmbed } from '@/lib/wordwall';

export async function POST(request:Request) {
  try {
    assertSameOrigin(request);
    const user=await requirePermission('createActivities');assertPermission(user,'createActivities');
    const body=await readAiJson(request);
    return jsonOk(await resolveWordwallEmbed(String(body.sourceUrl??'')));
  } catch(error) { return jsonError(error); }
}
