import { env } from "cloudflare:workers";
import { requireTrainer } from "@/app/auth";

const allowed=new Set(["image/png","image/jpeg"]);
const maxBytes=5*1024*1024;

export async function POST(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try{
    const form=await request.formData();
    const file=form.get("image");
    if(!(file instanceof File))return Response.json({error:"Aucune image reçue."},{status:400});
    if(!allowed.has(file.type))return Response.json({error:"Utilisez uniquement une image PNG ou JPEG."},{status:415});
    if(file.size>maxBytes)return Response.json({error:"L’image ne doit pas dépasser 5 Mo."},{status:413});
    if(!env.BUCKET)return Response.json({error:"Le stockage des images n’est pas disponible."},{status:503});
    const extension=file.type==="image/png"?"png":"jpg";
    const key=`activity-images/${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:"public, max-age=31536000, immutable"},customMetadata:{originalName:file.name.slice(0,120)}});
    return Response.json({key,url:`/api/media/${encodeURIComponent(key)}`,name:file.name,size:file.size});
  }catch{
    return Response.json({error:"Impossible d’enregistrer cette image."},{status:500});
  }
}
