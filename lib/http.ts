import { NextResponse } from 'next/server';
import { AppError } from './app-error';
export { AppError } from './app-error';
export function jsonOk<T>(data: T, status = 200) { return NextResponse.json({ ok: true, data }, { status }); }
export function jsonError(error: unknown) { if (error instanceof AppError) return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status }); console.error('Erreur serveur Progressed Pédago', error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error }); return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Une erreur technique est survenue. Réessayez dans quelques instants.' } }, { status: 500 }); }
export function cleanEmail(value: unknown): string { const email = String(value ?? '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError(400, 'Saisissez une adresse e-mail valide.', 'INVALID_EMAIL'); return email; }
export async function readJson(request: Request, maxBytes = 1_000_000): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new AppError(415, 'Le format de la requête n’est pas accepté.', 'UNSUPPORTED_MEDIA_TYPE');
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new AppError(413, 'La demande est trop volumineuse.', 'REQUEST_TOO_LARGE');
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new AppError(413, 'La demande est trop volumineuse.', 'REQUEST_TOO_LARGE');
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Les données envoyées sont invalides.', 'INVALID_JSON');
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'Les données envoyées sont invalides.', 'INVALID_JSON');
  }
}
export function assertSameOrigin(request: Request) { const origin = request.headers.get('origin'); if (!origin) return; if (origin !== new URL(request.url).origin) throw new AppError(403, 'Cette action a été refusée pour votre sécurité.', 'ORIGIN_MISMATCH'); }
