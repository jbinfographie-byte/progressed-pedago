import { env } from 'cloudflare:workers';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, learningPathItems, learningPaths, trainingShares } from '@/db/schema';
import { audit, getCurrentUser, requirePermission } from '@/lib/auth';
import { COURSE_IMAGE_PLACEMENTS, COURSE_IMAGE_STYLES, COURSE_IMAGE_WIDTHS, courseImagesFromContent, normalizeCourseImages, withCourseImages, type CourseImage } from '@/lib/course-images';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

type Context={params:Promise<{activityId:string;imageId:string}>};

export async function GET(_request:Request,context:Context) {
  try {
    const {activityId,imageId}=await context.params; const activity=(await getDb().select().from(activities).where(eq(activities.id,activityId)).limit(1))[0];
    if(!activity) throw new AppError(404,'Cette image est introuvable.','COURSE_IMAGE_NOT_FOUND');
    const image=courseImagesFromContent(JSON.parse(activity.contentJson)).find((item)=>item.id===imageId); if(!image) throw new AppError(404,'Cette image est introuvable.','COURSE_IMAGE_NOT_FOUND');
    const user=await getCurrentUser(); const owner=user?.id===activity.trainerId;
    const allowed=owner||(image.status==='validated'&&await belongsToActiveShare(activityId));
    if(!allowed) throw new AppError(404,'Cette image est introuvable.','COURSE_IMAGE_NOT_FOUND');
    const object=await env.FILES.get(image.objectKey); if(!object) throw new AppError(404,'Le fichier de cette image est introuvable.','COURSE_IMAGE_OBJECT_NOT_FOUND');
    return new Response(object.body,{headers:{'Content-Type':image.mimeType,'Content-Length':String(object.size),'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch(error) { return jsonError(error); }
}

export async function PATCH(request:Request,context:Context) {
  try {
    assertSameOrigin(request); const user=await requirePermission('editActivities'); const {activityId,imageId}=await context.params; const activity=await ownedActivity(activityId,user.id); const body=await readJson(request);
    const images=courseImagesFromContent(JSON.parse(activity.contentJson)); const current=images.find((item)=>item.id===imageId); if(!current) throw new AppError(404,'Cette image est introuvable.','COURSE_IMAGE_NOT_FOUND');
    const now=Math.floor(Date.now()/1000); const next:CourseImage={...current,updatedAt:now};
    if(typeof body.placement==='string'&&COURSE_IMAGE_PLACEMENTS.includes(body.placement as CourseImage['placement'])) next.placement=body.placement as CourseImage['placement'];
    if(typeof body.style==='string'&&COURSE_IMAGE_STYLES.includes(body.style as CourseImage['style'])) next.style=body.style as CourseImage['style'];
    if(typeof body.width==='string'&&COURSE_IMAGE_WIDTHS.includes(body.width as CourseImage['width'])) next.width=body.width as CourseImage['width'];
    if(body.fit==='contain'||body.fit==='cover') next.fit=body.fit;
    if(body.status==='draft'||body.status==='validated') next.status=body.status;
    if(typeof body.prompt==='string') next.prompt=body.prompt.trim().slice(0,3_000);
    if(typeof body.altText==='string') next.altText=body.altText.trim().slice(0,300)||'Illustration pédagogique';
    if(typeof body.caption==='string') next.caption=body.caption.trim().slice(0,500);
    if(body.focalX!==undefined) next.focalX=clamp(body.focalX,0,100,50);
    if(body.focalY!==undefined) next.focalY=clamp(body.focalY,0,100,50);
    if(body.position!==undefined) next.position=Math.round(clamp(body.position,0,Math.max(0,images.length-1),current.position));
    const reordered=images.filter((item)=>item.id!==imageId); reordered.splice(Math.min(next.position,reordered.length),0,next);
    const normalized=normalizeCourseImages(reordered.map((item,index)=>({...item,position:index})));
    await saveImages(activity.id,user.id,JSON.parse(activity.contentJson),normalized);
    if(next.placement==='cover'&&next.status==='validated') await updateTrainingCovers(activity.id,user.id,next.url,now);
    await audit(user.id,'course_image.updated','activity',activity.id,{imageId,placement:next.placement,status:next.status},request);
    return jsonOk({image:normalized.find((item)=>item.id===imageId),images:normalized,message:'Les réglages de l’image sont enregistrés.'});
  } catch(error) { return jsonError(error); }
}

export async function DELETE(request:Request,context:Context) {
  try {
    assertSameOrigin(request); const user=await requirePermission('editActivities'); const {activityId,imageId}=await context.params; const activity=await ownedActivity(activityId,user.id);
    const images=courseImagesFromContent(JSON.parse(activity.contentJson)); const image=images.find((item)=>item.id===imageId); if(!image) throw new AppError(404,'Cette image est introuvable.','COURSE_IMAGE_NOT_FOUND');
    await env.FILES.delete(image.objectKey); const remaining=images.filter((item)=>item.id!==imageId).map((item,index)=>({...item,position:index})); await saveImages(activity.id,user.id,JSON.parse(activity.contentJson),remaining);
    await audit(user.id,'course_image.deleted','activity',activity.id,{imageId},request); return jsonOk({images:remaining,message:'L’image a été retirée du cours.'});
  } catch(error) { return jsonError(error); }
}

async function ownedActivity(id:string,userId:string) { const row=(await getDb().select().from(activities).where(and(eq(activities.id,id),eq(activities.trainerId,userId))).limit(1))[0]; if(!row) throw new AppError(404,'Cette activité est introuvable.','ACTIVITY_NOT_FOUND'); return row; }
async function belongsToActiveShare(activityId:string):Promise<boolean> { const now=Math.floor(Date.now()/1000); const row=(await getDb().select({id:trainingShares.id}).from(trainingShares).innerJoin(learningPaths,eq(trainingShares.pathId,learningPaths.id)).innerJoin(learningPathItems,eq(learningPathItems.pathId,learningPaths.id)).where(and(eq(learningPathItems.activityId,activityId),eq(trainingShares.status,'active'),eq(trainingShares.sessionOpen,true),or(isNull(trainingShares.expiresAt),gt(trainingShares.expiresAt,now)))).limit(1))[0]; return Boolean(row); }
async function saveImages(activityId:string,userId:string,content:unknown,images:CourseImage[]) { await getDb().update(activities).set({contentJson:JSON.stringify(withCourseImages(content,images)),updatedAt:Math.floor(Date.now()/1000)}).where(and(eq(activities.id,activityId),eq(activities.trainerId,userId))); }
async function updateTrainingCovers(activityId:string,userId:string,url:string,now:number) { const rows=await getDb().select({trainingId:learningPaths.trainingId}).from(learningPathItems).innerJoin(learningPaths,eq(learningPathItems.pathId,learningPaths.id)).where(and(eq(learningPathItems.activityId,activityId),eq(learningPaths.trainerId,userId))); for(const row of rows) await getDb().update(courseFolders).set({coverImageUrl:url,updatedAt:now}).where(and(eq(courseFolders.id,row.trainingId),eq(courseFolders.trainerId,userId))); }
function clamp(value:unknown,minimum:number,maximum:number,fallback:number) { const number=Number(value); return Number.isFinite(number)?Math.min(maximum,Math.max(minimum,number)):fallback; }
