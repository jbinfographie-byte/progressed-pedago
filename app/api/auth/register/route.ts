import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, trainers } from "@/db/schema";
import { createSession, hashCode, makeSalt, normalizeEmail, recordAuthEvent, sessionHeader, validEmail, validPassword } from "@/app/auth";
import { sendAccessRequestEmail } from "@/app/email";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const password=String(body.password||"");
    if(!validEmail(email))return Response.json({error:"Saisissez une adresse e-mail valide."},{status:400});
    if(!validPassword(password))return Response.json({error:"Le mot de passe doit contenir au moins 12 caractères, une majuscule et un chiffre."},{status:400});
    const exists=await getDb().select({id:trainers.id,emailVerified:trainers.emailVerified}).from(trainers).where(eq(trainers.email,email)).limit(1);
    if(exists.length)return Response.json({error:exists[0].emailVerified?"Un accès existe déjà pour cette adresse.":"Votre demande est déjà enregistrée. Saisissez le code personnel envoyé par l’administrateur.",verificationRequired:!exists[0].emailVerified,email},{status:409});
    const first=await getDb().select({id:trainers.id}).from(trainers).limit(1);
    const [registration]=await getDb().select().from(appSettings).where(eq(appSettings.key,"registration_enabled")).limit(1);
    if(first.length&&registration?.value==="false")return Response.json({error:"Les nouvelles inscriptions sont momentanément fermées par l’administrateur."},{status:403});
    const salt=makeSalt();const codeHash=await hashCode(password,salt);const role=first.length?"trainer":"admin";
    if(role==="admin"){
      const [trainer]=await getDb().insert(trainers).values({email,codeHash,codeSalt:salt,role,status:"active",emailVerified:true,passwordVersion:3,mustChangePassword:false}).returning({id:trainers.id,email:trainers.email,role:trainers.role,mustChangePassword:trainers.mustChangePassword});
      await recordAuthEvent(email,"account_created","Premier compte administrateur validé");const session=await createSession(trainer.id);
      return Response.json({trainer},{status:201,headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
    }
    await getDb().insert(trainers).values({email,codeHash,codeSalt:salt,role,status:"pending",emailVerified:false,verificationHash:null,verificationExpiresAt:null,passwordVersion:3,mustChangePassword:false});
    const [admin]=await getDb().select({email:trainers.email}).from(trainers).where(eq(trainers.role,"admin")).limit(1);
    const notification=admin?await sendAccessRequestEmail(admin.email,email):{ok:false};
    await recordAuthEvent(email,"access_requested",notification.ok?"Administrateur averti par e-mail":"Demande visible dans l’administration");
    return Response.json({verificationRequired:true,email,message:notification.ok?"Votre demande a été envoyée à l’administrateur. Il pourra choisir puis vous envoyer votre code personnel.":"Votre demande est enregistrée et visible par l’administrateur. Il pourra choisir puis vous envoyer votre code personnel."},{status:202});
  }catch(error){console.error("Registration failed",error);return Response.json({error:"La création n’a pas abouti. Réessayez dans quelques instants."},{status:500})}
}
