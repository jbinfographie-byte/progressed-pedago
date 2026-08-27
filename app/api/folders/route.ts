import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { courseFolderFiles, courseFolderItems, courseFolders, uploadedFiles } from '@/db/schema';
import { audit, requirePermission, requireUser } from '@/lib/auth';
import { normalizeFolderColor, normalizeFolderDescription, normalizeFolderName } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET() {
  try {
    const user = await requireUser();
    const folders = await getDb().select().from(courseFolders).where(eq(courseFolders.trainerId,user.id)).orderBy(desc(courseFolders.updatedAt));
    const items = folders.length ? await getDb().select().from(courseFolderItems).where(inArray(courseFolderItems.folderId,folders.map((folder) => folder.id))).orderBy(courseFolderItems.position) : [];
    const fileItems = folders.length ? await getDb().select().from(courseFolderFiles).where(inArray(courseFolderFiles.folderId,folders.map((folder) => folder.id))).orderBy(courseFolderFiles.position) : [];
    const libraryFiles = await getDb().select({id:uploadedFiles.id,originalName:uploadedFiles.originalName,mimeType:uploadedFiles.mimeType,sizeBytes:uploadedFiles.sizeBytes,status:uploadedFiles.status,createdAt:uploadedFiles.createdAt}).from(uploadedFiles).where(eq(uploadedFiles.trainerId,user.id)).orderBy(desc(uploadedFiles.createdAt));
    return jsonOk({folders:folders.map((folder) => ({...folder,items:items.filter((item) => item.folderId === folder.id).map(({activityId,position}) => ({activityId,position})),fileItems:fileItems.filter((item) => item.folderId === folder.id).map(({fileId,position}) => ({fileId,position}))})),libraryFiles});
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const body = await readJson(request);
    const name = normalizeFolderName(body.name); if (name.length < 2) throw new AppError(400,'Donnez un nom d’au moins deux caractères au dossier.','FOLDER_NAME_REQUIRED');
    const id = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000);
    await getDb().insert(courseFolders).values({id,trainerId:user.id,name,description:normalizeFolderDescription(body.description),color:normalizeFolderColor(body.color),createdAt:now,updatedAt:now});
    await audit(user.id,'folder.created','course_folder',id,{name},request);
    return jsonOk({id,message:'Le dossier est créé. Cliquez dessus pour ajouter des jeux et des supports.'},201);
  } catch (error) { return jsonError(error); }
}
