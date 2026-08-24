import { getTrainer, recordAuthEvent } from "@/app/auth";
import { getOpenAIStatus, removeOpenAIKey, saveOpenAIKey } from "@/app/ai-config";

export async function GET(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401});
  return Response.json(await getOpenAIStatus(trainer.id));
}

export async function PUT(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401});
  try{
    const body=await request.json() as {apiKey?:string};
    await saveOpenAIKey(trainer.id,String(body.apiKey||""));
    await recordAuthEvent(trainer.email,"setting_changed","Clé OpenAI personnelle configurée");
    return Response.json({ok:true,message:"Votre clé OpenAI personnelle a été vérifiée et enregistrée."});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Connexion impossible."},{status:500})}
}

export async function DELETE(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401});
  try{
    await removeOpenAIKey(trainer.id);
    await recordAuthEvent(trainer.email,"setting_changed","Clé OpenAI personnelle supprimée");
    return Response.json({ok:true,message:"Votre connexion OpenAI personnelle a été supprimée."});
  }catch{return Response.json({error:"Suppression impossible."},{status:500})}
}
