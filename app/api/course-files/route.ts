import { env } from "cloudflare:workers";
import { getTrainer } from "@/app/auth";

const chunkLimit=600*1024;
const fileLimit=15*1024*1024;
const allowed:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",txt:"text/plain"};
const noStore={"Cache-Control":"no-store, max-age=0"};

function safeId(value:string){return /^[a-zA-Z0-9-]{20,80}$/.test(value)}
function extensionOf(name:string){const extension=name.toLowerCase().split(".").pop()||"";return allowed[extension]?extension:""}

export async function PUT(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401,headers:noStore});
  try{
    const uploadId=String(request.headers.get("x-upload-id")||"");const chunkIndex=Number(request.headers.get("x-chunk-index"));
    if(!safeId(uploadId)||!Number.isInteger(chunkIndex)||chunkIndex<0||chunkIndex>40)return Response.json({error:"Transfert de fichier invalide."},{status:400,headers:noStore});
    const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>chunkLimit)return Response.json({error:"Un morceau du fichier est trop volumineux."},{status:413,headers:noStore});
    const key=`course-chunks/${trainer.id}/${uploadId}/${chunkIndex}`;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:"application/octet-stream"}});
    return Response.json({ok:true,chunkIndex},{headers:noStore});
  }catch{return Response.json({error:"Le transfert du fichier a été interrompu. Réessayez."},{status:500,headers:noStore})}
}

export async function POST(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401,headers:noStore});
  try{
    const body=await request.json() as {uploadId?:string;name?:string;type?:string;size?:number;totalChunks?:number};
    const uploadId=String(body.uploadId||"");const name=String(body.name||"").slice(0,160);const extension=extensionOf(name);const totalChunks=Number(body.totalChunks);const expectedSize=Number(body.size);
    if(!safeId(uploadId)||!extension||!Number.isInteger(totalChunks)||totalChunks<1||totalChunks>40||!Number.isFinite(expectedSize)||expectedSize<1||expectedSize>fileLimit)return Response.json({error:"Impossible de finaliser ce fichier. Vérifiez son format et sa taille."},{status:400,headers:noStore});
    const parts:Uint8Array[]=[];let total=0;
    for(let index=0;index<totalChunks;index++){const key=`course-chunks/${trainer.id}/${uploadId}/${index}`;const object=await env.BUCKET.get(key);if(!object)return Response.json({error:`Le transfert de « ${name} » est incomplet. Relancez l’import.`},{status:409,headers:noStore});const part=new Uint8Array(await object.arrayBuffer());parts.push(part);total+=part.byteLength;if(total>fileLimit)return Response.json({error:`Le fichier « ${name} » dépasse 15 Mo.`},{status:413,headers:noStore})}
    if(total!==expectedSize)return Response.json({error:`Le fichier « ${name} » est incomplet. Relancez l’import.`},{status:409,headers:noStore});
    const merged=new Uint8Array(total);let offset=0;for(const part of parts){merged.set(part,offset);offset+=part.byteLength}
    const mime=allowed[extension];const finalKey=`course-sources/${trainer.id}/${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(finalKey,merged,{httpMetadata:{contentType:mime,contentDisposition:`inline; filename="${name.replace(/["\\]/g,"")}"`},customMetadata:{originalName:name}});
    for(let index=0;index<totalChunks;index++){try{await env.BUCKET.delete(`course-chunks/${trainer.id}/${uploadId}/${index}`)}catch{/* Le fichier final est déjà sécurisé. */}}
    return Response.json({source:{name,key:finalKey,size:total,type:mime,url:`/api/media/${encodeURIComponent(finalKey)}`}},{headers:noStore});
  }catch{return Response.json({error:"Le fichier n’a pas pu être préparé pour l’analyse."},{status:500,headers:noStore})}
}
