import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accessInvitations, appSettings, trainers } from "@/db/schema";
import { createSession, hashCode, makeSalt, normalizeEmail, recordAuthEvent, safeEqual, sessionHeader, sha256, validEmail, validPassword } from "@/app/auth";
import { sendAccessRequestEmail } from "@/app/email";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const password=String(body.password||"");const accessCode=String(body.accessCode||"").trim().toUpperCase();
    if(!validEmail(email))return Response.json({error:"Saisissez une adresse e-mail valide."},{status:400});
    if(!validPassword(password))return Response.json({error:"Le mot de passe doit contenir au moins 12 caractères, une majuscule et un chiffre."},{status:400});
    const first=await getDb().select({id:trainers.id}).from(trainers).limit(1);
    const salt=makeSalt();const passwordHash=await hashCode(password,salt);
    if(!first.length){
      const [trainer]=await getDb().insert(trainers).values({email,codeHash:passwordHash,codeSalt:salt,role:"admin",status:"active",emailVerified:true,passwordVersion:3,mustChangePassword:false}).returning({id:trainers.id,email:trainers.email,role:trainers.role,mustChangePassword:trainers.mustChangePassword});
      await recordAuthEvent(email,"account_created","Premier compte administrateur validé");const session=await createSession(trainer.id);
      return Response.json({trainer},{status:201,headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
    }
    const [registration]=await getDb().select().from(appSettings).where(eq(appSettings.key,"registration_enabled")).limit(1);if(registration?.value==="false")return Response.json({error:"Les nouvelles inscriptions sont momentanément fermées par l’administrateur."},{status:403});
    const [existing]=await getDb().select({id:trainers.id,emailVerified:trainers.emailVerified}).from(trainers).where(eq(trainers.email,email)).limit(1);
    if(accessCode){
      if(accessCode.length<10||accessCode.length>32||!/^[A-Z0-9-]+$/.test(accessCode))return Response.json({error:"Le code d’autorisation n’a pas le bon format."},{status:400});
      const [invitation]=await getDb().select().from(accessInvitations).where(eq(accessInvitations.email,email)).limit(1);if(!invitation||invitation.usedAt)return Response.json({error:"Aucune autorisation valide ne correspond à cette adresse e-mail."},{status:403});if(new Date(invitation.expiresAt)<new Date())return Response.json({error:"Cette autorisation a expiré. Demandez un nouveau code à l’administrateur."},{status:410});if(!safeEqual(await sha256(`${email}:${accessCode}`),invitation.codeHash))return Response.json({error:"Le code d’autorisation est incorrect."},{status:401});if(existing?.emailVerified)return Response.json({error:"Un accès existe déjà pour cette adresse."},{status:409});
      let trainerId:number;if(existing){trainerId=existing.id;await getDb().update(trainers).set({codeHash:passwordHash,codeSalt:salt,status:"active",emailVerified:true,verificationHash:null,verificationExpiresAt:null,passwordVersion:3,mustChangePassword:false,failedAttempts:0,lockedUntil:null}).where(eq(trainers.id,existing.id))}else{const [created]=await getDb().insert(trainers).values({email,codeHash:passwordHash,codeSalt:salt,role:"trainer",status:"active",emailVerified:true,passwordVersion:3,mustChangePassword:false}).returning({id:trainers.id});trainerId=created.id}
      await getDb().update(accessInvitations).set({usedAt:new Date().toISOString()}).where(eq(accessInvitations.id,invitation.id));await recordAuthEvent(email,"invitation_accepted","Compte formateur activé");const session=await createSession(trainerId);return Response.json({trainer:{email,role:"trainer",mustChangePassword:false}},{status:201,headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
    }
    if(existing)return Response.json({error:existing.emailVerified?"Un accès existe déjà pour cette adresse.":"Votre demande est déjà enregistrée. Saisissez le code personnel envoyé par l’administrateur.",verificationRequired:!existing.emailVerified,email},{status:409});
    await getDb().insert(trainers).values({email,codeHash:passwordHash,codeSalt:salt,role:"trainer",status:"pending",emailVerified:false,verificationHash:null,verificationExpiresAt:null,passwordVersion:3,mustChangePassword:false});
    const [admin]=await getDb().select({email:trainers.email}).from(trainers).where(eq(trainers.role,"admin")).limit(1);
    const notification=admin?await sendAccessRequestEmail(admin.email,email):{ok:false};
    await recordAuthEvent(email,"access_requested",notification.ok?"Administrateur averti par e-mail":"Demande visible dans l’administration");
    return Response.json({verificationRequired:true,email,message:notification.ok?"Votre demande a été envoyée à l’administrateur. Il pourra choisir puis vous envoyer votre code personnel.":"Votre demande est enregistrée et visible par l’administrateur. Il pourra choisir puis vous envoyer votre code personnel."},{status:202});
  }catch(error){console.error("Registration failed",error);return Response.json({error:"La création n’a pas abouti. Réessayez dans quelques instants."},{status:500})}
}
