import { getDb } from '@/db';
import { mainFolders } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { normalizeFolderColor, normalizeFolderCoverUrl, normalizeFolderLongDescription, normalizeFolderName, normalizeFolderText, normalizeFolderTextList } from '@/lib/course-folders';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('editActivities'); const body = await readJson(request);
    const name = normalizeFolderName(body.name); if (name.length < 2) throw new AppError(400,'Donnez un nom d’au moins deux caractères au métier ou au thème.','MAIN_FOLDER_NAME_REQUIRED');
    const id = crypto.randomUUID(); const now = Math.floor(Date.now() / 1000);
    await getDb().insert(mainFolders).values({id,trainerId:user.id,name,description:normalizeFolderLongDescription(body.description),sector:normalizeFolderText(body.sector,180),audience:normalizeFolderText(body.audience,220),coverImageUrl:normalizeFolderCoverUrl(body.coverImageUrl),color:normalizeFolderColor(body.color),keywordsJson:JSON.stringify(normalizeFolderTextList(body.keywords)),competenciesJson:JSON.stringify(normalizeFolderTextList(body.competencies)),createdAt:now,updatedAt:now});
    await audit(user.id,'main_folder.created','main_folder',id,{name},request);
    return jsonOk({id,message:'Le dossier métier ou thématique est créé. Vous pouvez maintenant y ajouter plusieurs formations.'},201);
  } catch (error) { return jsonError(error); }
}
