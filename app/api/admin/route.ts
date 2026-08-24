import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, authEvents, trainerSessions, trainers } from "@/db/schema";
import { hashCode, makeSalt, recordAuthEvent, requireAdmin, sha256, validPassword } from "@/app/auth";
import { getEmailStatus, removeEmailConfig, saveEmailConfig, sendAccessCodeEmail } from "@/app/email";
import { getOpenAIStatus, removeOpenAIKey, saveOpenAIKey } from "@/app/ai-config";

export async function GET(request:Request){
  try{
    const admin=await requireAdmin(request);if(!admin)return Response.json({error:"Accès administrateur requis."},{status:403});
    const [accounts,events,settings,aiStatus,emailStatus]=await Promise.all([
      getDb().select({id:trainers.id,email:trainers.email,role:trainers.role,status:trainers.status,emailVerified:trainers.emailVerified,verificationExpiresAt:trainers.verificationExpiresAt,failedAttempts:trainers.failedAttempts,lockedUntil:trainers.lockedUntil,lastLoginAt:trainers.lastLoginAt,mustChangePassword:trainers.mustChangePassword,createdAt:trainers.createdAt}).from(trainers).orderBy(desc(trainers.createdAt)),
      getDb().select().from(authEvents).orderBy(desc(authEvents.createdAt)).limit(50),
      getDb().select().from(appSettings),
      getOpenAIStatus(admin.id),
      getEmailStatus(),
    ]);
    return Response.json({accounts,events,settings:{registrationEnabled:settings.find(s=>s.key==="registration_enabled")?.value!=="false",emailConfigured:emailStatus.configured,emailSource:emailStatus.source,emailFrom:emailStatus.from,aiConfigured:aiStatus.configured,aiSource:aiStatus.source}});
  }catch{return Response.json({error:"Impossible de charger l’administration."},{status:500})}
}

export async function PATCH(request:Request){
  try{
    const admin=await requireAdmin(request);if(!admin)return Response.json({error:"Accès administrateur requis."},{status:403});
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="issue-access-code"){
      const trainerId=Number(body.trainerId);
      const [target]=await getDb().select({id:trainers.id,email:trainers.email,emailVerified:trainers.emailVerified,role:trainers.role}).from(trainers).where(eq(trainers.id,trainerId)).limit(1);
      if(!target||target.role!=="trainer")return Response.json({error:"Demande formateur introuvable."},{status:404});
      if(target.emailVerified)return Response.json({error:"Ce formateur possède déjà un accès autorisé."},{status:409});
      const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const random=crypto.getRandomValues(new Uint8Array(10));const generated=Array.from(random,byte=>alphabet[byte%alphabet.length]).join("");const code=String(body.accessCode||generated).trim().toUpperCase();
      if(code.length<10||code.length>32||!/^[A-Z0-9-]+$/.test(code)||!/[A-Z]/.test(code)||!/\d/.test(code))return Response.json({error:"Choisissez un code de 10 à 32 caractères avec au moins une lettre et un chiffre. Le tiret est autorisé."},{status:400});
      const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
      await getDb().update(trainers).set({status:"pending",verificationHash:await sha256(`${target.email}:${code}`),verificationExpiresAt:expiresAt,failedAttempts:0,lockedUntil:null}).where(eq(trainers.id,target.id));
      const sent=await sendAccessCodeEmail(target.email,code,expiresAt);
      await recordAuthEvent(target.email,"access_code_issued",`Par ${admin.email} • valable 7 jours`);
      return Response.json({ok:true,code,email:target.email,expiresAt,emailSent:sent.ok,message:sent.ok?"Le code a été envoyé au formateur par e-mail.":"Le code est créé, mais l’e-mail n’a pas été envoyé. Copiez-le ou configurez la messagerie."});
    }
    if(action==="email-config"){
      await saveEmailConfig(String(body.apiKey||""),String(body.emailFrom||""));await recordAuthEvent(admin.email,"setting_changed","Messagerie Resend configurée");return Response.json({ok:true,message:"La messagerie a été enregistrée et activée."});
    }
    if(action==="remove-email-config"){
      await removeEmailConfig();await recordAuthEvent(admin.email,"setting_changed","Messagerie Resend supprimée");return Response.json({ok:true,message:"La configuration de messagerie a été supprimée."});
    }
    if(action==="status"){
      const trainerId=Number(body.trainerId);const status=body.status==="inactive"?"inactive":"active";
      if(trainerId===admin.id&&status==="inactive")return Response.json({error:"Vous ne pouvez pas désactiver votre propre compte."},{status:400});
      const [target]=await getDb().select({email:trainers.email,emailVerified:trainers.emailVerified}).from(trainers).where(eq(trainers.id,trainerId)).limit(1);if(!target)return Response.json({error:"Compte introuvable."},{status:404});
      if(status==="active"&&!target.emailVerified)return Response.json({error:"Ce compte doit d’abord valider le code unique administrateur."},{status:409});
      await getDb().update(trainers).set({status,failedAttempts:0,lockedUntil:null}).where(eq(trainers.id,trainerId));
      if(status==="inactive")await getDb().delete(trainerSessions).where(eq(trainerSessions.trainerId,trainerId));
      await recordAuthEvent(target.email,status==="active"?"account_enabled":"account_disabled",`Par ${admin.email}`);return Response.json({ok:true});
    }
    if(action==="reset-password"){
      const trainerId=Number(body.trainerId);const password=String(body.password||"");if(!validPassword(password))return Response.json({error:"Le mot de passe temporaire doit contenir au moins 12 caractères, une majuscule et un chiffre."},{status:400});
      const [target]=await getDb().select({email:trainers.email}).from(trainers).where(eq(trainers.id,trainerId)).limit(1);if(!target)return Response.json({error:"Compte introuvable."},{status:404});
      const salt=makeSalt();await getDb().update(trainers).set({codeSalt:salt,codeHash:await hashCode(password,salt),passwordVersion:3,mustChangePassword:true,failedAttempts:0,lockedUntil:null,status:"active"}).where(eq(trainers.id,trainerId));
      await getDb().delete(trainerSessions).where(eq(trainerSessions.trainerId,trainerId));await recordAuthEvent(target.email,"password_reset",`Par ${admin.email}`);return Response.json({ok:true});
    }
    if(action==="registration"){
      const enabled=Boolean(body.enabled);await getDb().insert(appSettings).values({key:"registration_enabled",value:String(enabled),updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:appSettings.key,set:{value:String(enabled),updatedAt:new Date().toISOString()}});
      await recordAuthEvent(admin.email,"setting_changed",enabled?"Inscriptions ouvertes":"Inscriptions fermées");return Response.json({ok:true});
    }
    if(action==="openai-key"){
      const apiKey=String(body.apiKey||"");await saveOpenAIKey(admin.id,apiKey);
      await recordAuthEvent(admin.email,"setting_changed","Clé OpenAI personnelle configurée");return Response.json({ok:true,message:"Votre clé OpenAI personnelle a été vérifiée et enregistrée."});
    }
    if(action==="remove-openai-key"){
      await removeOpenAIKey(admin.id);await recordAuthEvent(admin.email,"setting_changed","Clé OpenAI personnelle supprimée");return Response.json({ok:true,message:"Votre clé OpenAI personnelle a été supprimée."});
    }
    return Response.json({error:"Action inconnue."},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Impossible d’appliquer cette action."},{status:500})}
}
