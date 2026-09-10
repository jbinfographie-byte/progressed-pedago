import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { knowledgeFolders } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET() {
  try {
    const user = await requirePermission('uploadDocuments');
    const folders = await getDb().select().from(knowledgeFolders).where(eq(knowledgeFolders.trainerId, user.id)).orderBy(desc(knowledgeFolders.updatedAt));
    return jsonOk({ folders });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const body = await readJson(request);
    const name = String(body.name ?? '').trim().slice(0, 100); const description = String(body.description ?? '').trim().slice(0, 500);
    if (name.length < 2) throw new AppError(400, 'Le nom du dossier doit contenir au moins deux caractères.', 'FOLDER_NAME_REQUIRED');
    const id = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000);
    await getDb().insert(knowledgeFolders).values({ id, trainerId: user.id, name, description, createdAt: now, updatedAt: now });
    await audit(user.id, 'knowledge_folder.created', 'knowledge_folder', id, {}, request);
    return jsonOk({ folder: { id, name, description }, message: 'Le dossier documentaire a été créé.' }, 201);
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const body = await readJson(request);
    const id = String(body.id ?? ''); const name = String(body.name ?? '').trim().slice(0, 100); const description = String(body.description ?? '').trim().slice(0, 500);
    if (!id || name.length < 2) throw new AppError(400, 'Le dossier et son nom sont obligatoires.', 'FOLDER_INVALID');
    const folder = (await getDb().select({ id: knowledgeFolders.id }).from(knowledgeFolders).where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.trainerId, user.id))).limit(1))[0];
    if (!folder) throw new AppError(404, 'Ce dossier documentaire est introuvable.', 'FOLDER_NOT_FOUND');
    await getDb().update(knowledgeFolders).set({ name, description, updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.trainerId, user.id)));
    await audit(user.id, 'knowledge_folder.updated', 'knowledge_folder', id, {}, request);
    return jsonOk({ message: 'Le dossier documentaire a été renommé.' });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const id = new URL(request.url).searchParams.get('id') ?? '';
    const folder = (await getDb().select({ id: knowledgeFolders.id }).from(knowledgeFolders).where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.trainerId, user.id))).limit(1))[0];
    if (!folder) throw new AppError(404, 'Ce dossier documentaire est introuvable.', 'FOLDER_NOT_FOUND');
    await getDb().delete(knowledgeFolders).where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.trainerId, user.id)));
    await audit(user.id, 'knowledge_folder.deleted', 'knowledge_folder', id, {}, request);
    return jsonOk({ message: 'Le dossier a été supprimé. Ses documents sont conservés.' });
  } catch (error) { return jsonError(error); }
}
