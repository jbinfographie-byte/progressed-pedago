import { env } from "cloudflare:workers";
import { requireTrainer } from "@/app/auth";

const maxPdfBytes=15*1024*1024;

function toBase64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer);let binary="";const chunk=0x8000;
  for(let offset=0;offset<bytes.length;offset+=chunk)binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));
  return btoa(binary);
}

export async function POST(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try{
    const form=await request.formData();const file=form.get("coursePdf");
    if(!(file instanceof File)||!file.size)return Response.json({error:"Choisissez d’abord le PDF à analyser."},{status:400});
    if(file.type!=="application/pdf")return Response.json({error:"Le document doit être au format PDF."},{status:415});
    if(file.size>maxPdfBytes)return Response.json({error:"Le PDF ne doit pas dépasser 15 Mo."},{status:413});
    const secrets=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
    if(!secrets.OPENAI_API_KEY)return Response.json({error:"La connexion à l’intelligence artificielle n’est pas encore configurée. L’administrateur doit ajouter la clé OpenAI dans les réglages du site."},{status:503});
    const schema={type:"object",additionalProperties:false,properties:{documentTitle:{type:"string"},pageCount:{type:"integer"},language:{type:"string"},suggestedTheme:{type:"string"},suggestedObjectives:{type:"array",items:{type:"string"}},pages:{type:"array",items:{type:"object",additionalProperties:false,properties:{pageNumber:{type:"integer"},title:{type:"string"},summary:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},usable:{type:"boolean"}},required:["pageNumber","title","summary","keyPoints","usable"]}},warnings:{type:"array",items:{type:"string"}}},required:["documentTitle","pageCount","language","suggestedTheme","suggestedObjectives","pages","warnings"]};
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${secrets.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:secrets.OPENAI_MODEL||"gpt-5.6",store:false,reasoning:{effort:"medium"},input:[{role:"user",content:[{type:"input_file",filename:file.name,file_data:`data:application/pdf;base64,${toBase64(await file.arrayBuffer())}`},{type:"input_text",text:"Analyse ce PDF page par page pour un formateur. Pour chaque page, donne un titre court, un résumé fidèle en français simple, 2 à 5 points importants et indique si la page est pédagogiquement exploitable. Ne génère encore aucun cours ni exercice. Le formateur doit d’abord pouvoir contrôler et sélectionner les pages. Si plusieurs pages forment une même notion, conserve malgré tout une fiche distincte par page. Signale les pages vides, illisibles ou principalement décoratives."}]}],text:{format:{type:"json_schema",name:"pdf_page_analysis",strict:true,schema}}})});
    if(!response.ok){const detail=await response.text();return Response.json({error:response.status===401?"La connexion OpenAI n’est pas valide. Vérifiez la clé configurée.":`L’analyse du PDF a échoué (${response.status}). Réessayez avec un document plus léger.`,detail:detail.slice(0,180)},{status:502})}
    const data=await response.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>};
    const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).map(item=>item.text||"").join("")||"";
    const analysis=JSON.parse(raw) as {pages?:unknown[]};
    if(!Array.isArray(analysis.pages)||!analysis.pages.length)return Response.json({error:"Aucune page exploitable n’a été détectée dans ce PDF."},{status:422});
    return Response.json({analysis,file:{name:file.name,size:file.size}});
  }catch{return Response.json({error:"Le PDF n’a pas pu être analysé. Vérifiez qu’il n’est pas protégé ou endommagé."},{status:500})}
}
