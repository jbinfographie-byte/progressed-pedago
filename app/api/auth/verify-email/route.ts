import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { createSession, normalizeEmail, recordAuthEvent, safeEqual, sessionHeader, sha256 } from "@/app/auth";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const code=String(body.code||"").trim();
    if(!/^\d{6}$/.test(code))return Response.json({error:"Saisissez le code à 6 chiffres reçu par e-mail."},{status:400});
    const [trainer]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!trainer||trainer.emailVerified)return Response.json({error:"Cette demande de validation est introuvable."},{status:404});
    if(!trainer.verificationExpiresAt||new Date(trainer.verificationExpiresAt)<new Date())return Response.json({error:"Ce code a expiré. Recommencez la création de votre accès."},{status:410});
    const expected=await sha256(`${email}:${code}`);if(!trainer.verificationHash||!safeEqual(expected,trainer.verificationHash)){await recordAuthEvent(email,"verification_failed");return Response.json({error:"Le code de validation est incorrect."},{status:401})}
    await getDb().update(trainers).set({emailVerified:true,status:"active",verificationHash:null,verificationExpiresAt:null}).where(eq(trainers.id,trainer.id));
    await recordAuthEvent(email,"email_verified");const session=await createSession(trainer.id);
    return Response.json({trainer:{email:trainer.email,role:trainer.role,mustChangePassword:trainer.mustChangePassword}},{headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
  }catch(error){console.error("Email verification failed",error);return Response.json({error:"La validation n’a pas abouti."},{status:500})}
}
