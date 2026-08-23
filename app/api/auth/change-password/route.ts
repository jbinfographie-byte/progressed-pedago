import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { getTrainer, hashCode, makeSalt, recordAuthEvent, safeEqual, validPassword } from "@/app/auth";

export async function POST(request:Request){
  try{
    const session=await getTrainer(request);if(!session)return Response.json({error:"Connexion requise."},{status:401});
    const body=await request.json() as Record<string,unknown>;const currentPassword=String(body.currentPassword||"");const newPassword=String(body.newPassword||"");
    if(!validPassword(newPassword))return Response.json({error:"Le nouveau mot de passe doit contenir entre 12 et 128 caractères."},{status:400});
    const [trainer]=await getDb().select().from(trainers).where(eq(trainers.id,session.id)).limit(1);
    const iterations=trainer.passwordVersion===1?120000:210000;
    if(!safeEqual(await hashCode(currentPassword,trainer.codeSalt,iterations),trainer.codeHash))return Response.json({error:"Le mot de passe actuel est incorrect."},{status:401});
    const salt=makeSalt();await getDb().update(trainers).set({codeSalt:salt,codeHash:await hashCode(newPassword,salt),passwordVersion:2,mustChangePassword:false,failedAttempts:0,lockedUntil:null}).where(eq(trainers.id,trainer.id));
    await recordAuthEvent(trainer.email,"password_changed");return Response.json({trainer:{email:trainer.email,role:trainer.role,mustChangePassword:false}});
  }catch{return Response.json({error:"Impossible de modifier le mot de passe."},{status:500})}
}
