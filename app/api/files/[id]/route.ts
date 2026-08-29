import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { knowledgeFolders, uploadedFiles } from '@/db/schema';
import { audit, requirePermission, requireUser } from '@/lib/auth';
import { safeDocumentName } from '@/lib/document-knowledge';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET(request: Request,context: {params: Promise<{id:string}>}) {
  try {
    const user = await requireUser(); const id = (await context.params).id;
    const file = (await getDb().select().from(uploadedFiles).where(and(eq(uploadedFiles.id,id),eq(uploadedFiles.trainerId,user.id))).limit(1))[0];
    if (!file) throw new AppError(404,'Ce support est introuvable.','FILE_NOT_FOUND');
    const object = await env.FILES.get(file.objectKey); if (!object) throw new AppError(404,'Le fichier du support est introuvable.','FILE_OBJECT_NOT_FOUND');
    const asciiName = file.originalName.replace(/[^A-Za-z0-9._-]+/g,'-').slice(-120) || 'support';
    const preview = new URL(request.url).searchParams.get('preview') === '1';
    return new Response(object.body,{headers:{'Content-Type':file.mimeType,'Content-Length':String(file.sizeBytes),'Content-Disposition':`${preview ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requirePermission('uploadDocuments');
    const id = (await context.params).id;
    const file = (await getDb().select().from(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.trainerId, user.id))).limit(1))[0];
    if (!file) throw new AppError(404, 'Ce support est introuvable.', 'FILE_NOT_FOUND');
    const body = await readJson(request);
    const values: Partial<typeof uploadedFiles.$inferInsert> = { updatedAt: Math.floor(Date.now() / 1000) };
    if (typeof body.originalName === 'string') {
      const extension = file.originalName.includes('.') ? `.${file.originalName.split('.').pop()}` : '';
      let requested = safeDocumentName(body.originalName);
      if (extension && !requested.toLocaleLowerCase().endsWith(extension.toLocaleLowerCase())) requested += extension;
      values.originalName = requested;
    }
    if (body.knowledgeFolderId === null || body.knowledgeFolderId === '') values.knowledgeFolderId = null;
    else if (typeof body.knowledgeFolderId === 'string') {
      const folder = (await getDb().select({ id: knowledgeFolders.id }).from(knowledgeFolders).where(and(eq(knowledgeFolders.id, body.knowledgeFolderId), eq(knowledgeFolders.trainerId, user.id))).limit(1))[0];
      if (!folder) throw new AppError(404, 'Ce dossier documentaire est introuvable.', 'KNOWLEDGE_FOLDER_NOT_FOUND');
      values.knowledgeFolderId = folder.id;
    }
    await getDb().update(uploadedFiles).set(values).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.trainerId, user.id)));
    await audit(user.id, 'file.updated', 'uploaded_file', id, { renamed: Boolean(values.originalName), folderChanged: 'knowledgeFolderId' in values }, request);
    return jsonOk({ message: 'Le document a été mis à jour.' });
  } catch (error) { return jsonError(error); }
}
