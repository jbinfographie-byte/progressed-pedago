import { requireTrainer } from "@/app/auth";
import { getOpenAIConfig } from "@/app/ai-config";

type Source={title:string;url:string;publisher:string};
type Lesson={title:string;summary:string;keyPoints:string[];steps:string[];learnerTip:string;hook:string;miniChallenge:string;memoryAid:string;sources:Source[]};

function fallback(title:string,theme:string):Lesson {
  return {
    title:`Comprendre : ${title}`,
    summary:`Ce module présente les notions essentielles du thème « ${theme} » avant de réaliser l’activité. Il sert de repère pour comprendre la consigne et progresser après chaque réponse.`,
    keyPoints:["Lire l’objectif et la consigne avant de commencer","Repérer les informations importantes","Comparer sa réponse avec l’explication proposée"],
    steps:["Observer la situation ou la question","Choisir une réponse en s’appuyant sur le cours","Lire la correction puis recommencer si nécessaire"],
    learnerTip:"Prenez le temps de comprendre l’explication : l’objectif n’est pas seulement de trouver la bonne réponse, mais de savoir la justifier.",
    hook:`Avant de commencer, quelle règle vous semble la plus importante sur le thème « ${theme} » ?`,
    miniChallenge:"Expliquez en une phrase une bonne pratique à retenir avant de lancer l’activité.",
    memoryAid:"Je découvre → Je réfléchis → Je réponds → Je comprends",
    sources:[],
  };
}

export async function POST(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  const body=await request.json() as {title?:string;theme?:string;type?:string;introduction?:string;questions?:Array<{question?:string;answer?:string;explanation?:string}>};
  const title=String(body.title||"Activité pédagogique").trim();const theme=String(body.theme||title).trim();
  const config=await getOpenAIConfig();
  if(!config)return Response.json({error:"La connexion à l’intelligence artificielle n’est pas configurée."},{status:503});
  const schema={type:"object",additionalProperties:false,properties:{
    title:{type:"string"},summary:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},steps:{type:"array",items:{type:"string"}},learnerTip:{type:"string"},hook:{type:"string"},miniChallenge:{type:"string"},memoryAid:{type:"string"},
    sources:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},url:{type:"string"},publisher:{type:"string"}},required:["title","url","publisher"]}},
  },required:["title","summary","keyPoints","steps","learnerTip","hook","miniChallenge","memoryAid","sources"]};
  const questions=(body.questions||[]).slice(0,10).map((question,index)=>`${index+1}. ${question.question||""}\nRéponse attendue : ${question.answer||""}\nExplication existante : ${question.explanation||""}`).join("\n\n");
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${config.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({
      model:config.model,store:false,reasoning:{effort:"medium"},tools:[{type:"web_search"}],tool_choice:"required",include:["web_search_call.action.sources"],
      instructions:"Tu es ingénieur pédagogique pour adultes et documentaliste. Recherche des sources primaires ou institutionnelles fiables, puis rédige un mini-cours en français simple qui prépare réellement l’apprenant à l’activité. Le résumé doit expliquer les notions, les points essentiels doivent être concrets, les étapes doivent former une méthode applicable et le conseil doit favoriser l’autonomie. Ajoute une question d’accroche, un défi de moins d’une minute et une astuce mémo. Le ton doit être ludique sans infantiliser. N’invente aucune règle métier. Vérifie la cohérence avec chaque question et chaque bonne réponse.",
      input:`TITRE : ${title}\nTHÈME : ${theme}\nFORMAT : ${body.type||"Activité pédagogique"}\nINTRODUCTION : ${body.introduction||"Aucune"}\n\nQUESTIONS ET CORRECTIONS :\n${questions}\n\nGénère un cours préparatoire clair, structuré et directement compréhensible par un adulte en formation.`,
      text:{format:{type:"json_schema",name:"pedagogical_lesson",strict:true,schema}},
    })});
    if(!response.ok)throw new Error("OpenAI response failed");
    const data=await response.json() as {output_text?:string;output?:Array<{type?:string;action?:{sources?:Array<{url?:string}>};content?:Array<{text?:string}>}>};
    const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).map(content=>content.text||"").join("")||"";
    const lesson=JSON.parse(raw) as Lesson;
    const consulted=new Set((data.output||[]).flatMap(item=>item.type==="web_search_call"?(item.action?.sources||[]):[]).map(source=>String(source.url||"")));
    lesson.sources=(lesson.sources||[]).filter(source=>/^https:\/\//.test(source.url)&&consulted.has(source.url)).slice(0,8);
    lesson.keyPoints=(lesson.keyPoints||[]).map(String).filter(Boolean).slice(0,6);lesson.steps=(lesson.steps||[]).map(String).filter(Boolean).slice(0,6);
    if(!lesson.summary||lesson.keyPoints.length<2||lesson.steps.length<2)throw new Error("Incomplete lesson");
    return Response.json({lesson,mode:"openai-research"});
  }catch{
    return Response.json({lesson:fallback(title,theme),mode:"demo",notice:"La génération documentée n’a pas abouti. Un cours simple a été créé pour révision."});
  }
}
