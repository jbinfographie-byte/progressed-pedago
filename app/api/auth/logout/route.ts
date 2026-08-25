import { assertSameOrigin, jsonError, jsonOk } from '@/lib/http';
import { clearSession } from '@/lib/auth';
export async function POST(request: Request) { try { assertSameOrigin(request); await clearSession(); return jsonOk({ message: 'Vous êtes déconnecté.' }); } catch (error) { return jsonError(error); } }
