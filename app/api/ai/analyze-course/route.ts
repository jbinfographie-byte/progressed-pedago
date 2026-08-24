import { getTrainer } from "@/app/auth";
import { getOpenAIConfig } from "@/app/ai-config";

const extensionTypes:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",txt:"text/plain"};
const maxFileBytes=15*1024*1024;
const maxTotalBytes=40*1024*1024;
const maxFiles=12;
const noStore={"Cache-Control":"no-store, max-age=0"};

function toBase64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer);let binary="";const chunk=0x4000;
  for(let offset=0;offset<bytes.length;offset+=chunk)binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));
  return btoa(binary);
}

function uploadedFiles(form:FormData){
  const multiple=form.getAll("sourceFiles").filter((value):value is File=>value instanceof File&&value.size>0);
  const legacy=form.get("coursePdf");
  return multiple.length?multiple:legacy instanceof File&&legacy.size?[legacy]:[];
}

function normalizedType(file:File){
  const extension=file.name.toLowerCase().split(".").pop()||"";
  return extensionTypes[extension]||file.type;
}

export async function POST(request:Request){
  const trainer=await getTrainer(request);if(!trainer)return Response.json({error:"Connexion requise."},{status:401,headers:noStore});
  try{
    const form=await request.formData();const files=uploadedFiles(form);
    if(!files.length)return Response.json({error:"Choisissez au moins un PDF, une image PNG ou une image JPEG à analyser."},{status:400,headers:noStore});
    if(files.length>maxFiles)return Response.json({error:`Vous pouvez analyser jusqu’à ${maxFiles} fichiers en une fois.`},{status:400,headers:noStore});
    const invalid=files.find(file=>!Object.values(extensionTypes).includes(normalizedType(file)));
    if(invalid)return Response.json({error:`Le fichier « ${invalid.name} » n’est pas accepté. Formats autorisés : PDF, Word DOCX, TXT, PNG et JPEG.`},{status:415,headers:noStore});
    const oversized=files.find(file=>file.size>maxFileBytes);
    if(oversized)return Response.json({error:`Le fichier « ${oversized.name} » dépasse 15 Mo.`},{status:413,headers:noStore});
    const totalBytes=files.reduce((sum,file)=>sum+file.size,0);
    if(totalBytes>maxTotalBytes)return Response.json({error:"L’ensemble des fichiers dépasse 40 Mo. Retirez un document ou réduisez sa taille."},{status:413,headers:noStore});
    const config=await getOpenAIConfig(trainer.id);
    if(!config)return Response.json({error:"Ajoutez votre propre clé OpenAI dans Connexions avant d’utiliser l’analyse des documents."},{status:503,headers:noStore});

    const schema={type:"object",additionalProperties:false,properties:{documentTitle:{type:"string"},pageCount:{type:"integer"},language:{type:"string"},suggestedTheme:{type:"string"},suggestedAudiences:{type:"array",items:{type:"string"}},suggestedObjectives:{type:"array",items:{type:"string"}},pages:{type:"array",items:{type:"object",additionalProperties:false,properties:{sourceIndex:{type:"integer"},sourceName:{type:"string"},sourceType:{type:"string",enum:["pdf","image","document"]},pageNumber:{type:"integer"},title:{type:"string"},summary:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},usable:{type:"boolean"}},required:["sourceIndex","sourceName","sourceType","pageNumber","title","summary","keyPoints","usable"]}},warnings:{type:"array",items:{type:"string"}}},required:["documentTitle","pageCount","language","suggestedTheme","suggestedAudiences","suggestedObjectives","pages","warnings"]};
    const content:Array<Record<string,string>>=[];
    for(let index=0;index<files.length;index++){
      const file=files[index];const mime=normalizedType(file);const base64=toBase64(await file.arrayBuffer());
      content.push({type:"input_text",text:`SOURCE ${index+1} — nom exact : ${file.name}`});
      if(mime==="image/png"||mime==="image/jpeg")content.push({type:"input_image",image_url:`data:${mime};base64,${base64}`,detail:"high"});
      else content.push({type:"input_file",filename:file.name,file_data:`data:${mime};base64,${base64}`});
    }
    content.push({type:"input_text",text:`Analyse conjointement les ${files.length} sources fournies pour construire une base pédagogique unique. Lis le texte, les tableaux et les éléments visuels. Analyse chaque PDF de la première à la dernière page, y compris lorsqu’il résulte de plusieurs PDF fusionnés. Considère chaque image PNG ou JPEG comme une page autonome. Pour un fichier Word ou TXT, crée une fiche par grande section logique. Conserve l’ordre des sources. sourceIndex commence à 1 et correspond au numéro SOURCE indiqué ; sourceName reprend son nom exact ; pageNumber recommence à 1 pour chaque fichier. sourceType vaut pdf, image ou document. Pour chaque fiche, donne un titre court, un résumé fidèle en français simple, 2 à 5 points importants et indique si elle est pédagogiquement exploitable. Synthétise ensuite le thème commun, 2 à 4 publics plausibles et 3 à 6 objectifs pédagogiques avec des verbes d’action. Ne génère encore aucun cours ni exercice. Signale les contradictions, doublons, pages illisibles ou documents sans rapport dans warnings.`});

    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:config.model,store:false,reasoning:{effort:"medium"},max_output_tokens:18000,input:[{role:"user",content}],text:{format:{type:"json_schema",name:"multi_source_training_analysis",strict:true,schema}}})});
    if(!response.ok){let detail="";try{const payload=await response.json() as {error?:{message?:string}};detail=String(payload.error?.message||"")}catch{}const message=response.status===401?"La connexion OpenAI n’est plus valide. Reconnectez votre clé dans Connexions.":response.status===429?"OpenAI signale une limite de quota ou de facturation. Vérifiez votre projet OpenAI.":detail?`OpenAI n’a pas pu analyser les fichiers : ${detail.slice(0,220)}`:`L’analyse a échoué (${response.status}). Réessayez avec moins de fichiers.`;return Response.json({error:message},{status:response.status===401?401:502,headers:noStore})}
    const data=await response.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>};
    const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).map(item=>item.text||"").join("")||"";
    if(!raw)return Response.json({error:"L’analyse n’a renvoyé aucun résultat. Réessayez avec moins de pages."},{status:422,headers:noStore});
    const analysis=JSON.parse(raw) as {pageCount?:number;pages?:Array<{sourceIndex?:number;sourceName?:string;pageNumber?:number}>;warnings?:string[]};
    if(!Array.isArray(analysis.pages)||!analysis.pages.length)return Response.json({error:"Aucune page ou image exploitable n’a été détectée."},{status:422,headers:noStore});
    analysis.pages=analysis.pages.filter((page,index,list)=>Number.isInteger(page.sourceIndex)&&Number(page.sourceIndex)>0&&Number.isInteger(page.pageNumber)&&Number(page.pageNumber)>0&&list.findIndex(candidate=>candidate.sourceIndex===page.sourceIndex&&candidate.pageNumber===page.pageNumber)===index).sort((a,b)=>Number(a.sourceIndex)-Number(b.sourceIndex)||Number(a.pageNumber)-Number(b.pageNumber));
    analysis.pageCount=analysis.pages.length;analysis.warnings=Array.isArray(analysis.warnings)?analysis.warnings:[];
    const seenSources=new Set(analysis.pages.map(page=>Number(page.sourceIndex)));
    files.forEach((file,index)=>{if(!seenSources.has(index+1))analysis.warnings!.push(`Aucune fiche n’a été produite pour « ${file.name} ». Vérifiez le fichier puis relancez l’analyse.`)});
    return Response.json({analysis,files:files.map(file=>({name:file.name,size:file.size,type:normalizedType(file)})),totalBytes},{headers:noStore});
  }catch(error){const technical=error instanceof SyntaxError||error instanceof Error&&/expected pattern|failed to parse|invalid form/i.test(error.message);const message=technical?"Un fichier n’a pas pu être préparé pour l’analyse. Vérifiez qu’il s’agit bien d’un PDF, PNG ou JPEG valide, puis réessayez.":error instanceof Error&&error.message?error.message:"L’analyse n’a pas pu être terminée. Réessayez avec moins de fichiers.";return Response.json({error:message},{status:500,headers:noStore})}
}
