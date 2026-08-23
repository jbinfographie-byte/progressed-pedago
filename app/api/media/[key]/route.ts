import { env } from "cloudflare:workers";
import { requireTrainer } from "@/app/auth";

export async function GET(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try{
    const key=decodeURIComponent(new URL(request.url).pathname.split("/api/media/")[1]||"");
    if(!key||!key.startsWith("activity-images/"))return new Response("Image introuvable",{status:404});
    const object=await env.BUCKET?.get(key);
    if(!object)return new Response("Image introuvable",{status:404});
    const headers=new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag",object.httpEtag);
    headers.set("cache-control","public, max-age=31536000, immutable");
    return new Response(object.body,{headers});
  }catch{
    return new Response("Image introuvable",{status:404});
  }
}
