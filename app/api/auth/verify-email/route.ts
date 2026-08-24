import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { createSession, normalizeEmail, recordAuthEvent, safeEqual, sessionHeader, sha256 } from "@/app/auth";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const code=String(body.code||"").trim().toUpperCase();
    if(code.length<10||code.length>32||!/^[A-Z0-9-]+$/.test(code))return Response.json({error:"Saisissez le code personnel de 10 à 32 caractères envoyé par l’administrateur."},{status:400});
    const [trainer]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!trainer||trainer.emailVerified)return Response.json({error:"Cette demande d’accès est introuvable ou déjà validée."},{status:404});
    if(trainer.lockedUntil&&new Date(trainer.lockedUntil)>new Date())return Response.json({error:"Trop de codes incorrects. Réessayez dans 15 minutes."},{status:423});
    if(!trainer.verificationHash)return Response.json({error:"L’administrateur n’a pas encore généré votre code d’accès."},{status:409});
    if(!trainer.verificationExpiresAt||new Date(trainer.verificationExpiresAt)<new Date())return Response.json({error:"Ce code a expiré. Demandez un nouveau code à l’administrateur."},{status:410});
    const expected=await sha256(`${email}:${code}`);if(!safeEqual(expected,trainer.verificationHash)){
      const attempts=trainer.failedAttempts+1;const lockedUntil=attempts>=5?new Date(Date.now()+15*60*1000).toISOString():null;
      await getDb().update(trainers).set({failedAttempts:lockedUntil?0:attempts,lockedUntil}).where(eq(trainers.id,trainer.id));
      await recordAuthEvent(email,"access_code_failed",lockedUntil?"Saisie verrouillée 15 minutes":`Tentative ${attempts}/5`);
      return Response.json({error:lockedUntil?"Trop de codes incorrects. Réessayez dans 15 minutes.":"Le code d’accès est incorrect."},{status:401});
    }
    await getDb().update(trainers).set({emailVerified:true,status:"active",verificationHash:null,verificationExpiresAt:null,failedAttempts:0,lockedUntil:null,lastLoginAt:new Date().toISOString()}).where(eq(trainers.id,trainer.id));
    await recordAuthEvent(email,"access_approved","Code administrateur validé");const session=await createSession(trainer.id);
    return Response.json({trainer:{email:trainer.email,role:trainer.role,mustChangePassword:trainer.mustChangePassword}},{headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
  }catch(error){console.error("Email verification failed",error);return Response.json({error:"La validation n’a pas abouti."},{status:500})}
}
