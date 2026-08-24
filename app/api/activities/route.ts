import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { activities, appSettings } from "@/db/schema";
import { requireTrainer } from "@/app/auth";

export async function GET(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const [rows,hiddenSetting] = await Promise.all([
      getDb().select().from(activities).orderBy(desc(activities.createdAt)).limit(100),
      getDb().select({value:appSettings.value}).from(appSettings).where(eq(appSettings.key,"hidden_starter_activities")).limit(1),
    ]);
    let hiddenStarterIds:number[]=[];try{hiddenStarterIds=JSON.parse(hiddenSetting[0]?.value||"[]")}catch{/* Une valeur illisible équivaut à aucune activité masquée. */}
    return Response.json({ hiddenStarterIds,activities:rows.map(row=>{const metadata=JSON.parse(row.qualityJson||"{}");return {
      ...row,
      questions:JSON.parse(row.questionsJson||"[]"),
      sources:JSON.parse(row.researchJson||"[]"),
      quality:metadata.quality||metadata,
      lesson:metadata.lesson||null,
      generationChoices:metadata.generationChoices||null,
      coverImageUrl:row.imageKey?`/api/media/${encodeURIComponent(row.imageKey)}`:null,
    }}) });
  } catch {
    return Response.json({ activities:[] });
  }
}

export async function POST(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const body = await request.json() as Record<string,unknown>;
    const title = String(body.title||"").trim();
    if (!title) return Response.json({ error:"Le titre est obligatoire." },{ status:400 });
    const values = {
      title,
      type:String(body.type||"Quiz"),
      theme:String(body.theme||"Autre"),
      duration:Number(body.duration||10),
      questionsJson:JSON.stringify(body.questions||[]),
      researchJson:JSON.stringify(body.sources||[]),
      qualityJson:JSON.stringify({quality:body.quality||{},lesson:body.lesson||null,generationChoices:body.generationChoices||null}),
      imageKey:body.imageKey?String(body.imageKey):null,
      imageAlt:body.imageAlt?String(body.imageAlt):null,
      source:String(body.source||"manual"),
      externalUrl:body.externalUrl?String(body.externalUrl):null,
    };
    const [activity] = await getDb().insert(activities).values(values).returning();
    const metadata=JSON.parse(activity.qualityJson||"{}");
    return Response.json({ activity:{
      ...activity,
      questions:JSON.parse(activity.questionsJson),
      sources:JSON.parse(activity.researchJson),
      quality:metadata.quality||metadata,
      lesson:metadata.lesson||null,
      generationChoices:metadata.generationChoices||null,
      coverImageUrl:activity.imageKey?`/api/media/${encodeURIComponent(activity.imageKey)}`:null,
    } },{ status:201 });
  } catch {
    return Response.json({ error:"Impossible d’enregistrer l’activité." },{ status:500 });
  }
}

export async function PATCH(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const body=await request.json() as Record<string,unknown>;
    const id=Number(body.id);if(!Number.isInteger(id)||id<1)return Response.json({error:"Activité invalide."},{status:400});
    const [activity]=await getDb().update(activities).set({qualityJson:JSON.stringify({quality:body.quality||{},lesson:body.lesson||null,generationChoices:body.generationChoices||null})}).where(eq(activities.id,id)).returning();
    if(!activity)return Response.json({error:"Activité introuvable."},{status:404});
    return Response.json({ok:true});
  } catch {
    return Response.json({error:"Impossible d’enregistrer le cours généré."},{status:500});
  }
}

export async function DELETE(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const body=await request.json() as {id?:number;starterId?:number};
    const starterId=Number(body.starterId);
    if(Number.isInteger(starterId)&&[1,2,3,4].includes(starterId)){
      const [setting]=await getDb().select({value:appSettings.value}).from(appSettings).where(eq(appSettings.key,"hidden_starter_activities")).limit(1);
      let hidden:number[]=[];try{hidden=JSON.parse(setting?.value||"[]")}catch{/* La liste sera recréée proprement. */}
      const next=[...new Set([...hidden,starterId])];
      await getDb().insert(appSettings).values({key:"hidden_starter_activities",value:JSON.stringify(next),updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:appSettings.key,set:{value:JSON.stringify(next),updatedAt:new Date().toISOString()}});
      return Response.json({ok:true,starter:true});
    }
    const id=Number(body.id);if(!Number.isInteger(id)||id<1)return Response.json({error:"Activité invalide."},{status:400});
    const [activity]=await getDb().select().from(activities).where(eq(activities.id,id)).limit(1);
    if(!activity)return Response.json({error:"Activité introuvable."},{status:404});
    const metadata=JSON.parse(activity.qualityJson||"{}") as {lesson?:{sourceDocument?:{key?:string};sourceDocuments?:Array<{key?:string}>}};
    await getDb().delete(activities).where(eq(activities.id,id));
    if(activity.imageKey&&env.BUCKET){try{await env.BUCKET.delete(activity.imageKey)}catch{/* La fiche reste supprimée même si le nettoyage du fichier doit être retenté. */}}
    const documentKeys=[metadata.lesson?.sourceDocument?.key,...(metadata.lesson?.sourceDocuments||[]).map(document=>document.key)].filter((key):key is string=>Boolean(key));
    const uniqueDocumentKeys=[...new Set(documentKeys)];
    if(env.BUCKET){for(const key of uniqueDocumentKeys){try{await env.BUCKET.delete(key)}catch{/* Le nettoyage du document pourra être retenté sans restaurer la fiche. */}}}
    return Response.json({ok:true,deletedFile:Boolean(activity.imageKey||uniqueDocumentKeys.length)});
  } catch {
    return Response.json({error:"Impossible de supprimer cette activité."},{status:500});
  }
}
