import { env } from 'cloudflare:workers';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { uploadedFiles } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk } from '@/lib/http';

const ACCEPTED = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;

export async function GET() {
  try { const user = await requirePermission('uploadDocuments'); const files = await getDb().select().from(uploadedFiles).where(eq(uploadedFiles.trainerId, user.id)).orderBy(desc(uploadedFiles.createdAt)); return jsonOk({ files }); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const formData = await request.formData(); const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    if (!files.length) throw new AppError(400, 'Sélectionnez au moins un document.', 'NO_FILES');
    if (files.length > MAX_FILES) throw new AppError(400, `Vous pouvez importer au maximum ${MAX_FILES} fichiers à la fois.`, 'TOO_MANY_FILES');
    for (const file of files) { if (!ACCEPTED.has(file.type)) throw new AppError(400, `Le format de « ${file.name} » n’est pas accepté.`, 'INVALID_FILE_TYPE'); if (file.size > MAX_FILE_SIZE) throw new AppError(413, `« ${file.name} » dépasse la limite de 20 Mo.`, 'FILE_TOO_LARGE'); }
    const saved = [];
    for (const file of files) {
      const id = crypto.randomUUID(); const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120); const objectKey = `trainers/${user.id}/${id}/${safeName}`;
      await env.FILES.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { owner: user.id, originalName: file.name.slice(0, 200) } });
      await getDb().insert(uploadedFiles).values({ id, trainerId: user.id, objectKey, originalName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size, status: 'uploaded' });
      saved.push({ id, name: file.name, size: file.size, status: 'uploaded' });
    }
    await audit(user.id, 'files.uploaded', 'uploaded_file', null, { count: saved.length }, request);
    return jsonOk({ files: saved, message: `${saved.length} fichier(s) transféré(s) dans votre espace privé.` }, 201);
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const id = new URL(request.url).searchParams.get('id') ?? ''; const file = (await getDb().select().from(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.trainerId, user.id))).limit(1))[0]; if (!file) throw new AppError(404, 'Ce fichier est introuvable.', 'FILE_NOT_FOUND'); await env.FILES.delete(file.objectKey); await getDb().delete(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.trainerId, user.id))); await audit(user.id, 'file.deleted', 'uploaded_file', id, {}, request); return jsonOk({ message: 'Le fichier a été supprimé.' }); } catch (error) { return jsonError(error); }
}
