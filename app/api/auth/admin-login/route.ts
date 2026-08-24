import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { createSession, hashCode, normalizeEmail, recordAuthEvent, safeEqual, sessionHeader, validEmail } from "@/app/auth";

const denied=()=>Response.json({error:"Adresse administrateur ou mot de passe incorrect."},{status:401,headers:{"Cache-Control":"no-store"}});

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const password=String(body.password||"");
    if(!validEmail(email)||!password)return denied();
    const [account]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!account||account.role!=="admin"||!account.emailVerified||account.status!=="active"){
      await recordAuthEvent(email,"admin_login_failed","Compte non autorisé");return denied();
    }
    if(account.lockedUntil&&new Date(account.lockedUntil)>new Date())return Response.json({error:"Compte administrateur temporairement verrouillé. Réessayez plus tard."},{status:423,headers:{"Cache-Control":"no-store"}});
    const iterations=account.passwordVersion===1?120000:account.passwordVersion===2?210000:100000;
    if(!safeEqual(await hashCode(password,account.codeSalt,iterations),account.codeHash)){
      const attempts=account.failedAttempts+1;const lockedUntil=attempts>=5?new Date(Date.now()+30*60*1000).toISOString():null;
      await getDb().update(trainers).set({failedAttempts:attempts>=5?0:attempts,lockedUntil}).where(eq(trainers.id,account.id));
      await recordAuthEvent(email,"admin_login_failed",lockedUntil?"Compte verrouillé 30 minutes":`Tentative ${attempts}/5`);
      return lockedUntil?Response.json({error:"Trop de tentatives : compte administrateur verrouillé pendant 30 minutes."},{status:423,headers:{"Cache-Control":"no-store"}}):denied();
    }
    await getDb().update(trainers).set({failedAttempts:0,lockedUntil:null,lastLoginAt:new Date().toISOString()}).where(eq(trainers.id,account.id));
    await recordAuthEvent(email,"admin_login_success","Connexion administrateur sécurisée");
    const session=await createSession(account.id);
    return Response.json({trainer:{email:account.email,role:"admin",mustChangePassword:account.mustChangePassword}},{headers:{"set-cookie":sessionHeader(session.token,session.expires),"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Connexion administrateur momentanément indisponible."},{status:500,headers:{"Cache-Control":"no-store"}})}
}
