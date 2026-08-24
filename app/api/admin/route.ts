import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accessInvitations, appSettings, authEvents, trainerSessions, trainers } from "@/db/schema";
import { hashCode, makeSalt, normalizeEmail, recordAuthEvent, requireAdmin, sha256, validEmail, validPassword } from "@/app/auth";
function accessMailDraft(email:string,code:string,expiresAt:string){const subject="Invitation à rejoindre Progressed Pédago";const body=`Bonjour,\n\nJe vous invite à rejoindre l’espace formateur Progressed Pédago.\n\nVotre code d’activation : ${code}\n\nCe code est personnel et valable jusqu’au ${new Date(expiresAt).toLocaleString("fr-FR")}. Saisissez-le lors de la création de votre espace formateur.\n\nCordialement,\nL’administrateur Progressed Pédago`;return {emailSubject:subject,emailBody:body}}

export async function GET(request:Request){
  try{
    const admin=await requireAdmin(request);if(!admin)return Response.json({error:"Accès administrateur requis."},{status:403});
    const [accounts,events,settings,invitations]=await Promise.all([
      getDb().select({id:trainers.id,email:trainers.email,role:trainers.role,status:trainers.status,emailVerified:trainers.emailVerified,verificationExpiresAt:trainers.verificationExpiresAt,failedAttempts:trainers.failedAttempts,lockedUntil:trainers.lockedUntil,lastLoginAt:trainers.lastLoginAt,mustChangePassword:trainers.mustChangePassword,createdAt:trainers.createdAt}).from(trainers).orderBy(desc(trainers.createdAt)),
      getDb().select().from(authEvents).orderBy(desc(authEvents.createdAt)).limit(50),
      getDb().select().from(appSettings),
      getDb().select({id:accessInvitations.id,email:accessInvitations.email,expiresAt:accessInvitations.expiresAt,usedAt:accessInvitations.usedAt,createdBy:accessInvitations.createdBy,createdAt:accessInvitations.createdAt}).from(accessInvitations).orderBy(desc(accessInvitations.createdAt)).limit(50),
    ]);
    return Response.json({accounts,events,invitations,settings:{registrationEnabled:settings.find(s=>s.key==="registration_enabled")?.value!=="false"}});
  }catch{return Response.json({error:"Impossible de charger l’administration."},{status:500})}
}

export async function PATCH(request:Request){
  try{
    const admin=await requireAdmin(request);if(!admin)return Response.json({error:"Accès administrateur requis."},{status:403});
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="create-invitation"){
      const email=normalizeEmail(body.email);const code=String(body.accessCode||"").trim().toUpperCase();if(!validEmail(email))return Response.json({error:"Saisissez une adresse e-mail valide."},{status:400});if(code.length<10||code.length>32||!/^[A-Z0-9-]+$/.test(code)||!/[A-Z]/.test(code)||!/\d/.test(code))return Response.json({error:"Choisissez un code de 10 à 32 caractères avec au moins une lettre et un chiffre."},{status:400});
      const [existing]=await getDb().select({id:trainers.id,emailVerified:trainers.emailVerified}).from(trainers).where(eq(trainers.email,email)).limit(1);if(existing?.emailVerified)return Response.json({error:"Ce formateur possède déjà un accès autorisé."},{status:409});
      const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();const codeHash=await sha256(`${email}:${code}`);const now=new Date().toISOString();
      await getDb().insert(accessInvitations).values({email,codeHash,expiresAt,usedAt:null,createdBy:admin.email,createdAt:now}).onConflictDoUpdate({target:accessInvitations.email,set:{codeHash,expiresAt,usedAt:null,createdBy:admin.email,createdAt:now}});
      if(existing)await getDb().update(trainers).set({status:"pending",verificationHash:codeHash,verificationExpiresAt:expiresAt,failedAttempts:0,lockedUntil:null}).where(eq(trainers.id,existing.id));
      await recordAuthEvent(email,"invitation_created",`Par ${admin.email} • message préparé • valable 7 jours`);return Response.json({ok:true,email,code,expiresAt,...accessMailDraft(email,code,expiresAt),message:"L’autorisation est enregistrée. Copiez les informations ci-dessous dans votre messagerie."});
    }
    if(action==="issue-access-code"){
      const trainerId=Number(body.trainerId);
      const [target]=await getDb().select({id:trainers.id,email:trainers.email,emailVerified:trainers.emailVerified,role:trainers.role}).from(trainers).where(eq(trainers.id,trainerId)).limit(1);
      if(!target||target.role!=="trainer")return Response.json({error:"Demande formateur introuvable."},{status:404});
      if(target.emailVerified)return Response.json({error:"Ce formateur possède déjà un accès autorisé."},{status:409});
      const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const random=crypto.getRandomValues(new Uint8Array(10));const generated=Array.from(random,byte=>alphabet[byte%alphabet.length]).join("");const code=String(body.accessCode||generated).trim().toUpperCase();
      if(code.length<10||code.length>32||!/^[A-Z0-9-]+$/.test(code)||!/[A-Z]/.test(code)||!/\d/.test(code))return Response.json({error:"Choisissez un code de 10 à 32 caractères avec au moins une lettre et un chiffre. Le tiret est autorisé."},{status:400});
      const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
      const codeHash=await sha256(`${target.email}:${code}`);await getDb().update(trainers).set({status:"pending",verificationHash:codeHash,verificationExpiresAt:expiresAt,failedAttempts:0,lockedUntil:null}).where(eq(trainers.id,target.id));
      const now=new Date().toISOString();await getDb().insert(accessInvitations).values({email:target.email,codeHash,expiresAt,usedAt:null,createdBy:admin.email,createdAt:now}).onConflictDoUpdate({target:accessInvitations.email,set:{codeHash,expiresAt,usedAt:null,createdBy:admin.email,createdAt:now}});
      await recordAuthEvent(target.email,"access_code_issued",`Par ${admin.email} • message préparé • valable 7 jours`);
      return Response.json({ok:true,code,email:target.email,expiresAt,...accessMailDraft(target.email,code,expiresAt),message:"Le code est enregistré. Copiez les informations ci-dessous dans votre messagerie."});
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
    return Response.json({error:"Action inconnue."},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Impossible d’appliquer cette action."},{status:500})}
}
