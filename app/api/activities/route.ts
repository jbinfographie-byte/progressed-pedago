import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { activities } from "@/db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(activities).orderBy(desc(activities.createdAt)).limit(100);
    return Response.json({ activities:rows.map(row=>({ ...row, questions:JSON.parse(row.questionsJson||"[]") })) });
  } catch {
    return Response.json({ activities:[] });
  }
}

export async function POST(request:Request) {
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
      source:String(body.source||"manual"),
      externalUrl:body.externalUrl?String(body.externalUrl):null,
    };
    const [activity] = await getDb().insert(activities).values(values).returning();
    return Response.json({ activity:{ ...activity, questions:JSON.parse(activity.questionsJson) } },{ status:201 });
  } catch {
    return Response.json({ error:"Impossible d’enregistrer l’activité." },{ status:500 });
  }
}
