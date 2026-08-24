import { getTrainer } from "@/app/auth";
import { getOpenAIStatus } from "@/app/ai-config";

export async function GET(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401});
  return Response.json(await getOpenAIStatus(trainer.id));
}
