import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { uploadedFiles } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { AppError, jsonError } from '@/lib/http';

export async function GET(_request: Request,context: {params: Promise<{id:string}>}) {
  try {
    const user = await requireUser(); const id = (await context.params).id;
    const file = (await getDb().select().from(uploadedFiles).where(and(eq(uploadedFiles.id,id),eq(uploadedFiles.trainerId,user.id))).limit(1))[0];
    if (!file) throw new AppError(404,'Ce support est introuvable.','FILE_NOT_FOUND');
    const object = await env.FILES.get(file.objectKey); if (!object) throw new AppError(404,'Le fichier du support est introuvable.','FILE_OBJECT_NOT_FOUND');
    const asciiName = file.originalName.replace(/[^A-Za-z0-9._-]+/g,'-').slice(-120) || 'support';
    return new Response(object.body,{headers:{'Content-Type':file.mimeType,'Content-Length':String(file.sizeBytes),'Content-Disposition':`attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,'Cache-Control':'private, no-store'}});
  } catch (error) { return jsonError(error); }
}
