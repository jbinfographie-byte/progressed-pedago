import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { normalizeEmail, recordAuthEvent, sha256 } from "@/app/auth";
import { emailIsConfigured, sendVerificationEmail } from "@/app/email";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const [trainer]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!trainer||trainer.emailVerified)return Response.json({error:"Aucune validation en attente pour cette adresse."},{status:404});
    if(!emailIsConfigured())return Response.json({error:"Le service d’e-mail n’est pas encore configuré."},{status:503});
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000);const sent=await sendVerificationEmail(email,code);if(!sent.ok)return Response.json({error:sent.error},{status:502});
    await getDb().update(trainers).set({verificationHash:await sha256(`${email}:${code}`),verificationExpiresAt:new Date(Date.now()+15*60*1000).toISOString()}).where(eq(trainers.id,trainer.id));
    await recordAuthEvent(email,"verification_resent");return Response.json({message:"Un nouveau code vient d’être envoyé."});
  }catch{return Response.json({error:"Impossible de renvoyer le code."},{status:500})}
}
