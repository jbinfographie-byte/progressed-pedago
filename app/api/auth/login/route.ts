import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { createSession, hashCode, normalizeEmail, safeEqual, sessionHeader, validCode, validEmail } from "@/app/auth";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const code=String(body.code||"");
    if(!validEmail(email)||!validCode(code))return Response.json({error:"E-mail ou code incorrect."},{status:401});
    const [trainer]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!trainer||!safeEqual(await hashCode(code,trainer.codeSalt),trainer.codeHash))return Response.json({error:"E-mail ou code incorrect."},{status:401});
    const session=await createSession(trainer.id);
    return Response.json({trainer:{email:trainer.email}},{headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
  }catch{return Response.json({error:"Connexion momentanément indisponible."},{status:500})}
}
