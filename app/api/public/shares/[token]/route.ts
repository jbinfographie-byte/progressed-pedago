import { env } from 'cloudflare:workers';
import { and, count, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, courseFolders, externalResources, learnerProgress, learningPathItems, learningPaths, publicAccessEvents } from '@/db/schema';
import { AppError, jsonError, jsonOk } from '@/lib/http';
import { currentParticipant, publicShare } from '@/lib/training-sharing';
import { sha256 } from '@/lib/security';

export async function GET(request:Request,context:{params:Promise<{token:string}>}){
  let shareId:string|null=null;let ipHash:string|null=null;
  try{
    const forwarded=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'';ipHash=forwarded?await sha256(`${forwarded}${env.SECURITY_PEPPER}`):null;const now=Math.floor(Date.now()/1000);
    if(ipHash){const recent=(await getDb().select({total:count()}).from(publicAccessEvents).where(and(eq(publicAccessEvents.ipHash,ipHash),gt(publicAccessEvents.createdAt,now-300))))[0]?.total??0;if(recent>100)throw new AppError(429,'Trop de tentatives. Patientez quelques minutes.','PUBLIC_RATE_LIMIT');}
    const share=await publicShare(decodeURIComponent((await context.params).token));shareId=share.id;const training=(await getDb().select().from(courseFolders).where(and(eq(courseFolders.id,share.trainingId),eq(courseFolders.status,'published'))).limit(1))[0];if(!training)throw new AppError(410,'Cette formation n’est plus publiée.','TRAINING_UNAVAILABLE');
    const path=(await getDb().select().from(learningPaths).where(and(eq(learningPaths.id,share.pathId),eq(learningPaths.status,'published'))).limit(1))[0];if(!path)throw new AppError(410,'Ce parcours n’est plus publié.','PATH_UNAVAILABLE');
    const items=await getDb().select({pathItemId:learningPathItems.id,position:learningPathItems.position,required:learningPathItems.required,minScore:learningPathItems.minScore,unlockAfterPrevious:learningPathItems.unlockAfterPrevious,activityId:activities.id,type:activities.type,title:activities.title,theme:activities.theme,audience:activities.audience,level:activities.level,objectivesJson:activities.objectivesJson,durationMinutes:activities.durationMinutes,instructions:activities.instructions,contentJson:activities.contentJson,explanation:activities.explanation,sourcesJson:activities.sourcesJson,status:activities.status}).from(learningPathItems).innerJoin(activities,eq(learningPathItems.activityId,activities.id)).where(and(eq(learningPathItems.pathId,path.id),eq(activities.status,'published'))).orderBy(learningPathItems.position);
    const visibleItems=share.mode==='classroom'?[items.find((item)=>item.activityId===share.liveActivityId)??items[0]].filter((item):item is NonNullable<typeof item>=>Boolean(item)):items;
    const resources=await getDb().select().from(externalResources).where(and(eq(externalResources.trainingId,training.id),eq(externalResources.status,'active'))).orderBy(externalResources.createdAt);
    const participant=await currentParticipant(share);const progress=participant?await getDb().select().from(learnerProgress).where(eq(learnerProgress.participantId,participant.id)):[];
    await getDb().insert(publicAccessEvents).values({id:crypto.randomUUID(),shareId:share.id,ipHash,success:true,createdAt:now});
    return jsonOk({share:{shortCode:share.shortCode,mode:share.mode,liveActivityId:visibleItems[0]?.activityId??null,identityMode:share.identityMode,expiresAt:share.expiresAt,sessionOpen:share.sessionOpen},training:{id:training.id,name:training.name,description:training.description,audience:training.audience,level:training.level,durationMinutes:training.durationMinutes,coverImageUrl:training.coverImageUrl},path:{id:path.id,name:path.name,items:visibleItems.map((item)=>({...item,objectives:JSON.parse(item.objectivesJson),content:JSON.parse(item.contentJson),sources:JSON.parse(item.sourcesJson),objectivesJson:undefined,contentJson:undefined,sourcesJson:undefined}))},resources:resources.map((resource)=>({...resource,metadata:JSON.parse(resource.metadataJson),metadataJson:undefined})),participant:participant?{id:participant.id,displayName:participant.displayName,progressPercent:participant.progressPercent,lastPathItemId:participant.lastPathItemId,progress}:null});
  }catch(error){try{await getDb().insert(publicAccessEvents).values({id:crypto.randomUUID(),shareId,ipHash,success:false,createdAt:Math.floor(Date.now()/1000)});}catch{/* journalisation au mieux */}return jsonError(error);}
}
