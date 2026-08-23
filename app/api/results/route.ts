import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { results } from "@/db/schema";
import { requireTrainer } from "@/app/auth";

export async function GET(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const rows = await getDb().select().from(results).orderBy(desc(results.completedAt)).limit(500);
    return Response.json({ results:rows });
  } catch {
    return Response.json({ results:[] });
  }
}

export async function POST(request:Request) {
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try {
    const body = await request.json() as Record<string,unknown>;
    const learnerName = String(body.learnerName||"").trim();
    if (!learnerName) return Response.json({ error:"Le nom est obligatoire." },{ status:400 });
    const [result] = await getDb().insert(results).values({
      learnerName,
      activityTitle:String(body.activityTitle||"Activité"),
      activityType:String(body.activityType||"Quiz"),
      score:Number(body.score||0),
      maxScore:Number(body.maxScore||1),
      durationSeconds:Number(body.durationSeconds||0),
      answersJson:JSON.stringify(body.answers||[]),
    }).returning();
    return Response.json({ result },{ status:201 });
  } catch {
    return Response.json({ error:"Impossible d’enregistrer le résultat." },{ status:500 });
  }
}
