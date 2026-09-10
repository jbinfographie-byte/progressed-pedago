import { getCurrentUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function GET() { try { return jsonOk({ user: await getCurrentUser() }); } catch (error) { return jsonError(error); } }
