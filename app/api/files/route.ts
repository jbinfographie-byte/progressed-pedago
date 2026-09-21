import { env } from '@/lib/runtime-env';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { uploadedFiles } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, hasValidDocumentSignature, parseJsonList, safeDocumentName, safeObjectName } from '@/lib/document-knowledge';
import { AppError, assertSameOrigin, jsonError, jsonOk } from '@/lib/http';

const MAX_FILES = 10;

export async function GET() {
  try {
    const user = await requirePermission('uploadDocuments');
    const files = await getDb().select().from(uploadedFiles).where(eq(uploadedFiles.trainerId, user.id)).orderBy(desc(uploadedFiles.createdAt));
    return jsonOk({ files: files.map((file) => ({ ...file, keywords: parseJsonList(file.keywordsJson), analysisJson: undefined, objectKey: undefined })) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const formData = await request.formData(); const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    if (!files.length) throw new AppError(400, 'Sélectionnez au moins un document.', 'NO_FILES');
    if (files.length > MAX_FILES) throw new AppError(400, `Vous pouvez importer au maximum ${MAX_FILES} fichiers à la fois.`, 'TOO_MANY_FILES');
    const saved: Array<{ id:string; name:string; size:number; status:'uploaded' }> = [];
    const errors: Array<{ name:string; message:string; code:string }> = [];
    for (const file of files) {
      let objectKey = '';
      try {
        if (!DOCUMENT_MIME_TYPES.has(file.type)) throw new AppError(400, 'Format refusé. Utilisez PDF, Word, PowerPoint, texte, PNG ou JPEG.', 'INVALID_FILE_TYPE');
        if (!file.size) throw new AppError(400, 'Le fichier est vide.', 'EMPTY_FILE');
        if (file.size > DOCUMENT_MAX_BYTES) throw new AppError(413, 'Le fichier dépasse la limite de 20 Mo.', 'FILE_TOO_LARGE');
        const buffer = await file.arrayBuffer();
        if (!hasValidDocumentSignature(new Uint8Array(buffer), file.type)) throw new AppError(400, 'Le contenu du fichier ne correspond pas à son format annoncé.', 'INVALID_FILE_SIGNATURE');
        const id = crypto.randomUUID(); const originalName = safeDocumentName(file.name); objectKey = `trainers/${user.id}/${id}/${safeObjectName(file.name)}`;
        await env.FILES.put(objectKey, buffer, { httpMetadata: { contentType: file.type }, customMetadata: { owner: user.id, originalName } });
        const createdAt = Math.floor(Date.now() / 1000);
        try { await getDb().insert(uploadedFiles).values({ id, trainerId: user.id, objectKey, originalName, mimeType: file.type, sizeBytes: file.size, status: 'uploaded', createdAt, updatedAt: createdAt }); }
        catch (error) { await env.FILES.delete(objectKey); throw error; }
        saved.push({ id, name: originalName, size: file.size, status: 'uploaded' });
      } catch (error) {
        errors.push({ name: safeDocumentName(file.name), message: error instanceof Error ? error.message : 'Import impossible.', code: error instanceof AppError ? error.code : 'UPLOAD_FAILED' });
      }
    }
    if (!saved.length) throw new AppError(400, errors[0]?.message ?? 'Aucun fichier n’a pu être importé.', errors[0]?.code ?? 'UPLOAD_FAILED');
    await audit(user.id, 'files.uploaded', 'uploaded_file', null, { count: saved.length, failed: errors.length }, request);
    return jsonOk({ files: saved, errors, message: `${saved.length} fichier(s) transféré(s) dans votre espace privé.${errors.length ? ` ${errors.length} fichier(s) refusé(s).` : ''}` }, 201);
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); const user = await requirePermission('uploadDocuments'); const id = new URL(request.url).searchParams.get('id') ?? ''; const file = (await getDb().select().from(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.trainerId, user.id))).limit(1))[0]; if (!file) throw new AppError(404, 'Ce fichier est introuvable.', 'FILE_NOT_FOUND'); await env.FILES.delete(file.objectKey); await getDb().delete(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.trainerId, user.id))); await audit(user.id, 'file.deleted', 'uploaded_file', id, {}, request); return jsonOk({ message: 'Le fichier a été supprimé.' }); } catch (error) { return jsonError(error); }
}
