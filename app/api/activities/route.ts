import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { requireTrainer } from "@/app/auth";

export async function GET(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const rows = await getDb().select().from(activities).orderBy(desc(activities.createdAt)).limit(100);
    return Response.json({ activities:rows.map(row=>({
      ...row,
      questions:JSON.parse(row.questionsJson||"[]"),
      sources:JSON.parse(row.researchJson||"[]"),
      quality:JSON.parse(row.qualityJson||"{}"),
      coverImageUrl:row.imageKey?`/api/media/${encodeURIComponent(row.imageKey)}`:null,
    })) });
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
      qualityJson:JSON.stringify(body.quality||{}),
      imageKey:body.imageKey?String(body.imageKey):null,
      imageAlt:body.imageAlt?String(body.imageAlt):null,
      source:String(body.source||"manual"),
      externalUrl:body.externalUrl?String(body.externalUrl):null,
    };
    const [activity] = await getDb().insert(activities).values(values).returning();
    return Response.json({ activity:{
      ...activity,
      questions:JSON.parse(activity.questionsJson),
      sources:JSON.parse(activity.researchJson),
      quality:JSON.parse(activity.qualityJson),
      coverImageUrl:activity.imageKey?`/api/media/${encodeURIComponent(activity.imageKey)}`:null,
    } },{ status:201 });
  } catch {
    return Response.json({ error:"Impossible d’enregistrer l’activité." },{ status:500 });
  }
}
