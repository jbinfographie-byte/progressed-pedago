import { getTrainer, recordAuthEvent } from "@/app/auth";
import { getOpenAIStatus, OpenAIConnectionError, removeOpenAIKey, saveOpenAIKey } from "@/app/ai-config";

const noStore={"Cache-Control":"no-store, max-age=0"};

export async function GET(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401,headers:noStore});
  return Response.json(await getOpenAIStatus(trainer.id),{headers:noStore});
}

export async function PUT(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401,headers:noStore});
  try{
    const body=await request.json() as {apiKey?:string};
    await saveOpenAIKey(trainer.id,String(body.apiKey||""));
    await recordAuthEvent(trainer.email,"setting_changed","Clé OpenAI personnelle configurée");
    return Response.json({ok:true,configured:true,source:"personal",message:"Connexion validée : votre clé OpenAI personnelle est maintenant chiffrée et enregistrée pour votre compte."},{headers:noStore});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Connexion impossible."},{status:error instanceof OpenAIConnectionError?error.status:500,headers:noStore})}
}

export async function DELETE(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401,headers:noStore});
  try{
    await removeOpenAIKey(trainer.id);
    await recordAuthEvent(trainer.email,"setting_changed","Clé OpenAI personnelle supprimée");
    return Response.json({ok:true,message:"Votre connexion OpenAI personnelle a été supprimée."},{headers:noStore});
  }catch{return Response.json({error:"Suppression impossible."},{status:500,headers:noStore})}
}
