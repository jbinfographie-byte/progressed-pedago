import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainers } from "@/db/schema";
import { normalizeEmail, recordAuthEvent } from "@/app/auth";
import { sendAccessRequestEmail } from "@/app/email";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;const email=normalizeEmail(body.email);const [trainer]=await getDb().select().from(trainers).where(eq(trainers.email,email)).limit(1);
    if(!trainer||trainer.emailVerified)return Response.json({error:"Aucune demande d’accès en attente pour cette adresse."},{status:404});
    const [admin]=await getDb().select({email:trainers.email}).from(trainers).where(eq(trainers.role,"admin")).limit(1);
    const sent=admin?await sendAccessRequestEmail(admin.email,email):{ok:false};
    await recordAuthEvent(email,"access_request_reminded",sent.ok?"Administrateur relancé par e-mail":"Relance visible dans le journal");
    return Response.json({message:sent.ok?"L’administrateur a été relancé par e-mail.":"Votre demande reste enregistrée. L’administrateur la voit dans son espace."});
  }catch{return Response.json({error:"Impossible de relancer la demande."},{status:500})}
}
