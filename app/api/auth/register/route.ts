import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { createSession, hashCode, makeSalt, normalizeEmail, sessionHeader, validCode, validEmail } from "@/app/auth";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const code=String(body.code||"");
    if(!validEmail(email))return Response.json({error:"Saisissez une adresse e-mail valide."},{status:400});
    if(!validCode(code))return Response.json({error:"Le code doit contenir exactement 6 chiffres."},{status:400});
    const exists=await getDb().select({id:trainers.id}).from(trainers).where(eq(trainers.email,email)).limit(1);
    if(exists.length)return Response.json({error:"Un accès existe déjà pour cette adresse."},{status:409});
    const salt=makeSalt();const codeHash=await hashCode(code,salt);
    const [trainer]=await getDb().insert(trainers).values({email,codeHash,codeSalt:salt}).returning({id:trainers.id,email:trainers.email});
    const session=await createSession(trainer.id);
    return Response.json({trainer:{email:trainer.email}},{status:201,headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
  }catch{return Response.json({error:"Impossible de créer cet accès."},{status:500})}
}
