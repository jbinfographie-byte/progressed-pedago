import { getTrainer } from "@/app/auth";
import { getOpenAIConfig } from "@/app/ai-config";

const maxPdfBytes=15*1024*1024;

function toBase64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer);let binary="";const chunk=0x8000;
  for(let offset=0;offset<bytes.length;offset+=chunk)binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));
  return btoa(binary);
}

export async function POST(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401});
  try{
    const form=await request.formData();const file=form.get("coursePdf");
    if(!(file instanceof File)||!file.size)return Response.json({error:"Choisissez d’abord le PDF à analyser."},{status:400});
    if(file.type!=="application/pdf")return Response.json({error:"Le document doit être au format PDF."},{status:415});
    if(file.size>maxPdfBytes)return Response.json({error:"Le PDF ne doit pas dépasser 15 Mo."},{status:413});
    const config=await getOpenAIConfig(trainer.id);
    if(!config)return Response.json({error:"Ajoutez votre propre clé OpenAI dans Connexions avant d’utiliser l’analyse PDF."},{status:503});
    const schema={type:"object",additionalProperties:false,properties:{documentTitle:{type:"string"},pageCount:{type:"integer"},language:{type:"string"},suggestedTheme:{type:"string"},suggestedAudiences:{type:"array",items:{type:"string"}},suggestedObjectives:{type:"array",items:{type:"string"}},pages:{type:"array",items:{type:"object",additionalProperties:false,properties:{pageNumber:{type:"integer"},title:{type:"string"},summary:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},usable:{type:"boolean"}},required:["pageNumber","title","summary","keyPoints","usable"]}},warnings:{type:"array",items:{type:"string"}}},required:["documentTitle","pageCount","language","suggestedTheme","suggestedAudiences","suggestedObjectives","pages","warnings"]};
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:config.model,store:false,reasoning:{effort:"medium"},max_output_tokens:14000,input:[{role:"user",content:[{type:"input_file",filename:file.name,file_data:`data:application/pdf;base64,${toBase64(await file.arrayBuffer())}`,detail:"high"},{type:"input_text",text:"Analyse l’intégralité de ce PDF multipage pour un formateur, de la première à la dernière page, annexes comprises. Crée exactement une fiche par page réelle, dans l’ordre, même pour une page vide, décorative ou peu exploitable. Pour chaque page, donne un titre court, un résumé fidèle en français simple, 2 à 5 points importants et indique si elle est pédagogiquement exploitable. Détermine aussi le thème central, 2 à 4 publics professionnels plausibles et 3 à 6 objectifs pédagogiques formulés avec des verbes d’action. Ne génère encore aucun cours ni exercice : le formateur doit d’abord contrôler et sélectionner les pages. Signale toute page illisible, protégée ou manquante dans warnings."}]}],text:{format:{type:"json_schema",name:"pdf_page_analysis",strict:true,schema}}})});
    if(!response.ok){const detail=await response.text();return Response.json({error:response.status===401?"La connexion OpenAI n’est pas valide. Vérifiez la clé configurée.":`L’analyse du PDF a échoué (${response.status}). Réessayez avec un document plus léger.`,detail:detail.slice(0,180)},{status:502})}
    const data=await response.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>};
    const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).map(item=>item.text||"").join("")||"";
    const analysis=JSON.parse(raw) as {pageCount?:number;pages?:Array<{pageNumber?:number}>;warnings?:string[]};
    if(!Array.isArray(analysis.pages)||!analysis.pages.length)return Response.json({error:"Aucune page exploitable n’a été détectée dans ce PDF."},{status:422});
    analysis.pages=analysis.pages.filter((page,index,list)=>Number.isInteger(page.pageNumber)&&Number(page.pageNumber)>0&&list.findIndex(candidate=>candidate.pageNumber===page.pageNumber)===index).sort((a,b)=>Number(a.pageNumber)-Number(b.pageNumber));
    const expected=Math.max(Number(analysis.pageCount)||analysis.pages.length,analysis.pages.length);
    const detected=new Set(analysis.pages.map(page=>Number(page.pageNumber)));
    const missing=Array.from({length:expected},(_,index)=>index+1).filter(page=>!detected.has(page));
    analysis.warnings=Array.isArray(analysis.warnings)?analysis.warnings:[];
    if(missing.length)analysis.warnings.push(`Pages sans fiche détectée : ${missing.join(", ")}. Relancez l’analyse si elles contiennent des informations utiles.`);
    return Response.json({analysis,file:{name:file.name,size:file.size}});
  }catch{return Response.json({error:"Le PDF n’a pas pu être analysé. Vérifiez qu’il n’est pas protégé ou endommagé."},{status:500})}
}
