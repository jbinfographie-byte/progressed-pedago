import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { createSession, hashCode, normalizeEmail, recordAuthEvent, safeEqual, sessionHeader, validEmail } from "@/app/auth";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const password=String(body.password||"");
    if(!validEmail(email)||!password)return Response.json({error:"E-mail ou mot de passe incorrect."},{status:401});
    const [trainer]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!trainer){await recordAuthEvent(email,"login_failed","Compte inconnu");return Response.json({error:"E-mail ou mot de passe incorrect."},{status:401})}
    if(!trainer.emailVerified)return Response.json({error:"Votre accès attend encore le code unique de l’administrateur.",verificationRequired:true,email},{status:403});
    if(trainer.status!=="active")return Response.json({error:"Ce compte est désactivé. Contactez l’administrateur."},{status:403});
    if(trainer.lockedUntil&&new Date(trainer.lockedUntil)>new Date())return Response.json({error:"Compte temporairement verrouillé après plusieurs essais. Réessayez plus tard."},{status:423});
    const iterations=trainer.passwordVersion===1?120000:trainer.passwordVersion===2?210000:100000;
    if(!safeEqual(await hashCode(password,trainer.codeSalt,iterations),trainer.codeHash)){
      const attempts=trainer.failedAttempts+1;const lockedUntil=attempts>=5?new Date(Date.now()+15*60*1000).toISOString():null;
      await getDb().update(trainers).set({failedAttempts:attempts>=5?0:attempts,lockedUntil}).where(eq(trainers.id,trainer.id));
      await recordAuthEvent(email,"login_failed",lockedUntil?"Compte verrouillé 15 minutes":`Tentative ${attempts}/5`);
      return Response.json({error:lockedUntil?"Trop de tentatives : compte verrouillé pendant 15 minutes.":"E-mail ou mot de passe incorrect."},{status:401});
    }
    await getDb().update(trainers).set({failedAttempts:0,lockedUntil:null,lastLoginAt:new Date().toISOString()}).where(eq(trainers.id,trainer.id));
    await recordAuthEvent(email,"login_success");
    const session=await createSession(trainer.id);
    return Response.json({trainer:{email:trainer.email,role:trainer.role,mustChangePassword:trainer.mustChangePassword}},{headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
  }catch{return Response.json({error:"Connexion momentanément indisponible."},{status:500})}
}
