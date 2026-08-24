import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, authEvents, trainerSessions, trainers } from "@/db/schema";
import { hashCode, makeSalt, recordAuthEvent, requireAdmin, validPassword } from "@/app/auth";
import { emailIsConfigured } from "@/app/email";
import { getOpenAIStatus, removeOpenAIKey, saveOpenAIKey } from "@/app/ai-config";

export async function GET(request:Request){
  try{
    const admin=await requireAdmin(request);if(!admin)return Response.json({error:"Accès administrateur requis."},{status:403});
    const [accounts,events,settings,aiStatus]=await Promise.all([
      getDb().select({id:trainers.id,email:trainers.email,role:trainers.role,status:trainers.status,emailVerified:trainers.emailVerified,failedAttempts:trainers.failedAttempts,lockedUntil:trainers.lockedUntil,lastLoginAt:trainers.lastLoginAt,mustChangePassword:trainers.mustChangePassword,createdAt:trainers.createdAt}).from(trainers).orderBy(desc(trainers.createdAt)),
      getDb().select().from(authEvents).orderBy(desc(authEvents.createdAt)).limit(50),
      getDb().select().from(appSettings),
      getOpenAIStatus(admin.id),
    ]);
    return Response.json({accounts,events,settings:{registrationEnabled:settings.find(s=>s.key==="registration_enabled")?.value!=="false",emailConfigured:emailIsConfigured(),aiConfigured:aiStatus.configured,aiSource:aiStatus.source}});
  }catch{return Response.json({error:"Impossible de charger l’administration."},{status:500})}
}

export async function PATCH(request:Request){
  try{
    const admin=await requireAdmin(request);if(!admin)return Response.json({error:"Accès administrateur requis."},{status:403});
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="status"){
      const trainerId=Number(body.trainerId);const status=body.status==="inactive"?"inactive":"active";
      if(trainerId===admin.id&&status==="inactive")return Response.json({error:"Vous ne pouvez pas désactiver votre propre compte."},{status:400});
      const [target]=await getDb().select({email:trainers.email}).from(trainers).where(eq(trainers.id,trainerId)).limit(1);if(!target)return Response.json({error:"Compte introuvable."},{status:404});
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
