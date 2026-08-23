import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, trainers } from "@/db/schema";
import { createSession, hashCode, makeSalt, normalizeEmail, recordAuthEvent, sessionHeader, sha256, validEmail, validPassword } from "@/app/auth";
import { emailIsConfigured, sendVerificationEmail } from "@/app/email";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const password=String(body.password||"");
    if(!validEmail(email))return Response.json({error:"Saisissez une adresse e-mail valide."},{status:400});
    if(!validPassword(password))return Response.json({error:"Le mot de passe doit contenir au moins 12 caractères, une majuscule et un chiffre."},{status:400});
    const exists=await getDb().select({id:trainers.id,emailVerified:trainers.emailVerified}).from(trainers).where(eq(trainers.email,email)).limit(1);
    if(exists.length)return Response.json({error:exists[0].emailVerified?"Un accès existe déjà pour cette adresse.":"Un accès attend déjà la validation de cette adresse e-mail.",verificationRequired:!exists[0].emailVerified,email},{status:409});
    const first=await getDb().select({id:trainers.id}).from(trainers).limit(1);
    const [registration]=await getDb().select().from(appSettings).where(eq(appSettings.key,"registration_enabled")).limit(1);
    if(first.length&&registration?.value==="false")return Response.json({error:"Les nouvelles inscriptions sont momentanément fermées par l’administrateur."},{status:403});
    const salt=makeSalt();const codeHash=await hashCode(password,salt);const role=first.length?"trainer":"admin";
    if(role==="admin"){
      const [trainer]=await getDb().insert(trainers).values({email,codeHash,codeSalt:salt,role,status:"active",emailVerified:true,passwordVersion:3,mustChangePassword:false}).returning({id:trainers.id,email:trainers.email,role:trainers.role,mustChangePassword:trainers.mustChangePassword});
      await recordAuthEvent(email,"account_created","Premier compte administrateur validé");const session=await createSession(trainer.id);
      return Response.json({trainer},{status:201,headers:{"set-cookie":sessionHeader(session.token,session.expires)}});
    }
    if(!emailIsConfigured())return Response.json({error:"La validation par e-mail doit d’abord être configurée par l’administrateur."},{status:503});
    const random=crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000;const verificationCode=String(random);const verificationExpiresAt=new Date(Date.now()+15*60*1000).toISOString();
    const sent=await sendVerificationEmail(email,verificationCode);if(!sent.ok)return Response.json({error:sent.error},{status:502});
    await getDb().insert(trainers).values({email,codeHash,codeSalt:salt,role,status:"pending",emailVerified:false,verificationHash:await sha256(`${email}:${verificationCode}`),verificationExpiresAt,passwordVersion:3,mustChangePassword:false});
    await recordAuthEvent(email,"verification_sent","Code valable 15 minutes");
    return Response.json({verificationRequired:true,email,message:"Un code de validation vient de vous être envoyé par e-mail."},{status:202});
  }catch(error){console.error("Registration failed",error);return Response.json({error:"La création n’a pas abouti. Réessayez dans quelques instants."},{status:500})}
}
