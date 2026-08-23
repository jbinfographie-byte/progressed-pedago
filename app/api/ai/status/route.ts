import { requireTrainer } from "@/app/auth";
import { getOpenAIStatus } from "@/app/ai-config";

export async function GET(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  return Response.json(await getOpenAIStatus());
}
