import { getTrainer } from "@/app/auth";

export async function GET(request:Request){
  try{const trainer=await getTrainer(request);return Response.json({trainer:trainer?{email:trainer.email,role:trainer.role,mustChangePassword:trainer.mustChangePassword}:null},{status:trainer?200:401})}
  catch{return Response.json({trainer:null},{status:401})}
}
