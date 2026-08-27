import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolderItems, courseFolders } from '@/db/schema';
import { audit, requirePermission, requireUser } from '@/lib/auth';
import { normalizeFolderColor, normalizeFolderDescription, normalizeFolderName } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET() {
  try {
    const user = await requireUser();
    const folders = await getDb().select().from(courseFolders).where(eq(courseFolders.trainerId,user.id)).orderBy(desc(courseFolders.updatedAt));
    const items = folders.length ? await getDb().select().from(courseFolderItems).where(inArray(courseFolderItems.folderId,folders.map((folder) => folder.id))).orderBy(courseFolderItems.position) : [];
    return jsonOk({folders:folders.map((folder) => ({...folder,items:items.filter((item) => item.folderId === folder.id).map(({activityId,position}) => ({activityId,position}))}))});
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const body = await readJson(request);
    const name = normalizeFolderName(body.name); if (name.length < 2) throw new AppError(400,'Donnez un nom d’au moins deux caractères au dossier.','FOLDER_NAME_REQUIRED');
    const id = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000);
    await getDb().insert(courseFolders).values({id,trainerId:user.id,name,description:normalizeFolderDescription(body.description),color:normalizeFolderColor(body.color),createdAt:now,updatedAt:now});
    await audit(user.id,'folder.created','course_folder',id,{name},request);
    return jsonOk({id,message:'Le dossier est créé. Vous pouvez maintenant y ajouter des activités.'},201);
  } catch (error) { return jsonError(error); }
}
