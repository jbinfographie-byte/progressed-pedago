import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { requireTrainer } from "@/app/auth";

export async function GET(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const rows = await getDb().select().from(activities).orderBy(desc(activities.createdAt)).limit(100);
    return Response.json({ activities:rows.map(row=>{const metadata=JSON.parse(row.qualityJson||"{}");return {
      ...row,
      questions:JSON.parse(row.questionsJson||"[]"),
      sources:JSON.parse(row.researchJson||"[]"),
      quality:metadata.quality||metadata,
      lesson:metadata.lesson||null,
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
      qualityJson:JSON.stringify({quality:body.quality||{},lesson:body.lesson||null}),
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
    const [activity]=await getDb().update(activities).set({qualityJson:JSON.stringify({quality:body.quality||{},lesson:body.lesson||null})}).where(eq(activities.id,id)).returning();
    if(!activity)return Response.json({error:"Activité introuvable."},{status:404});
    return Response.json({ok:true});
  } catch {
    return Response.json({error:"Impossible d’enregistrer le cours généré."},{status:500});
  }
}

export async function DELETE(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const body=await request.json() as {id?:number};
    const id=Number(body.id);if(!Number.isInteger(id)||id<1)return Response.json({error:"Activité invalide."},{status:400});
    const [activity]=await getDb().select().from(activities).where(eq(activities.id,id)).limit(1);
    if(!activity)return Response.json({error:"Activité introuvable."},{status:404});
    await getDb().delete(activities).where(eq(activities.id,id));
    if(activity.imageKey&&env.BUCKET){try{await env.BUCKET.delete(activity.imageKey)}catch{/* La fiche reste supprimée même si le nettoyage du fichier doit être retenté. */}}
    return Response.json({ok:true,deletedFile:Boolean(activity.imageKey)});
  } catch {
    return Response.json({error:"Impossible de supprimer cette activité."},{status:500});
  }
}
