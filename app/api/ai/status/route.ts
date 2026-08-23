import { env } from "cloudflare:workers";
import { requireTrainer } from "@/app/auth";

export async function GET(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  const secrets=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
  return Response.json({configured:Boolean(secrets.OPENAI_API_KEY),model:secrets.OPENAI_MODEL||null});
}
