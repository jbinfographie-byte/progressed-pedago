import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, trainers } from "@/db/schema";
import { createSession, hashCode, makeSalt, normalizeEmail, recordAuthEvent, sessionHeader, validEmail, validPassword } from "@/app/auth";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const password=String(body.password||"");
    if(!validEmail(email))return Response.json({error:"Saisissez une adresse e-mail valide."},{status:400});
    if(!validPassword(password))return Response.json({error:"Le mot de passe doit contenir entre 12 et 128 caractères."},{status:400});
    const exists=await getDb().select({id:trainers.id}).from(trainers).where(eq(trainers.email,email)).limit(1);
    if(exists.length)return Response.json({error:"Un accès existe déjà pour cette adresse."},{status:409});
    const first=await getDb().select({id:trainers.id}).from(trainers).limit(1);
    const [registration]=await getDb().select().from(appSettings).where(eq(appSettings.key,"registration_enabled")).limit(1);
    if(first.length&&registration?.value==="false")return Response.json({error:"Les nouvelles inscriptions sont momentanément fermées par l’administrateur."},{status:403});
    const salt=makeSalt();const codeHash=await hashCode(password,salt);const role=first.length?"trainer":"admin";
    const [trainer]=await getDb().insert(trainers).values({email,codeHash,codeSalt:salt,role,passwordVersion:2,mustChangePassword:false}).returning({id:trainers.id,email:trainers.email,role:trainers.role,mustChangePassword:trainers.mustChangePassword});
    await recordAuthEvent(email,"account_created",role==="admin"?"Premier compte administrateur":"Compte formateur");
    const session=await createSession(trainer.id);
    return Response.json({trainer},{status:201,headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
  }catch{return Response.json({error:"Impossible de créer cet accès."},{status:500})}
}
