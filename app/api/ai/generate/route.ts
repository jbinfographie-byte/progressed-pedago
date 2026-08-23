import { env } from "cloudflare:workers";

type Source={ title:string; url:string; publisher:string };
type Question={ question:string; options:string[]; correct:number; explanation:string; objective:string; difficulty:string; sourceIndexes:number[] };
type Generated={ title:string; type:string; theme:string; duration:number; introduction:string; questions:Question[]; sources:Source[]; quality:{ score:number; factualConsistency:boolean; noAmbiguity:boolean; levelFit:boolean; cleanFrench:boolean; duplicateFree:boolean; reviewSummary:string } };

function fallback(theme:string,type:string,count:number):Generated {
  const topic=theme.trim()||"les bonnes pratiques professionnelles";
  const base=[
    {question:`Quel est le premier réflexe professionnel concernant « ${topic} » ?`,options:["Observer la situation et consulter les consignes","Agir immédiatement sans préparation","Ignorer les informations disponibles"],correct:0,explanation:"L’observation et la consultation des consignes permettent d’agir de façon adaptée.",objective:"Identifier la première étape",difficulty:"Débutant",sourceIndexes:[]},
    {question:`Comment vérifier qu’une consigne liée à « ${topic} » est comprise ?`,options:["La faire reformuler ou démontrer","La répéter plus fort","Supprimer l’étape pratique"],correct:0,explanation:"La reformulation ou la démonstration permet de contrôler la compréhension.",objective:"Contrôler la compréhension",difficulty:"Débutant",sourceIndexes:[]},
    {question:"Quelle méthode permet de progresser après une erreur ?",options:["Analyser, corriger puis recommencer","Masquer l’erreur","Arrêter définitivement l’activité"],correct:0,explanation:"Une correction suivie d’un nouvel essai transforme l’erreur en apprentissage.",objective:"Adopter une démarche de correction",difficulty:"Intermédiaire",sourceIndexes:[]},
  ];
  return {title:`Quiz : ${topic.slice(0,52)}`,type,theme:topic,duration:Math.max(8,count*2),introduction:"Répondez aux questions puis consultez les explications.",questions:Array.from({length:count},(_,i)=>({...base[i%base.length],question:i<3?base[i].question:`${base[i%3].question} — situation ${i+1}`})),sources:[],quality:{score:70,factualConsistency:true,noAmbiguity:true,levelFit:true,cleanFrench:true,duplicateFree:true,reviewSummary:"Brouillon pédagogique sans recherche web : les informations métier doivent être validées avant diffusion."}};
}

function cleanActivity(raw:Generated,count:number):Generated {
  const seen=new Set<string>();
  const questions=(Array.isArray(raw.questions)?raw.questions:[]).filter(q=>{
    const key=String(q.question||"").trim().toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;
  }).slice(0,count).map(q=>{
    const options=(Array.isArray(q.options)?q.options:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,4);
    return {...q,question:String(q.question).trim(),options,correct:Number.isInteger(q.correct)&&q.correct>=0&&q.correct<options.length?q.correct:0,explanation:String(q.explanation||"").trim(),objective:String(q.objective||"").trim(),difficulty:String(q.difficulty||"Intermédiaire"),sourceIndexes:(q.sourceIndexes||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<(raw.sources||[]).length)};
  }).filter(q=>q.options.length>=2&&q.explanation);
  const sources=(raw.sources||[]).filter(s=>/^https:\/\//.test(String(s.url||""))).slice(0,8);
  const structural=questions.length===count&&questions.every(q=>q.options.length>=3&&new Set(q.options.map(x=>x.toLowerCase())).size===q.options.length);
  const sourced=questions.every(q=>q.sourceIndexes.length>0)||sources.length===0;
  const baseScore=structural?90:68;
  return {...raw,questions,sources,quality:{...raw.quality,score:Math.min(Number(raw.quality?.score||baseScore),structural&&sourced?100:82),noAmbiguity:structural,duplicateFree:questions.length===new Set(questions.map(q=>q.question.toLowerCase())).size,reviewSummary:structural?(raw.quality?.reviewSummary||"Structure, réponses et formulation contrôlées."):"Certaines questions ont été écartées lors du contrôle automatique."}};
}

export async function POST(request:Request) {
  const body=await request.json() as {theme?:string;objective?:string;audience?:string;prompt?:string;type?:string;count?:number;level?:string;research?:boolean};
  const theme=String(body.theme||"").trim();
  const type=String(body.type||"Quiz interactif");
  const count=Math.min(10,Math.max(3,Number(body.count||5)));
  if(!theme)return Response.json({error:"Le thème est obligatoire."},{status:400});
  const secrets=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
  if(!secrets.OPENAI_API_KEY)return Response.json({activity:fallback(theme,type,count),mode:"demo",notice:"Ajoutez une clé API OpenAI pour activer la recherche de sources."});

  const schema={type:"object",additionalProperties:false,properties:{
    title:{type:"string"},type:{type:"string"},theme:{type:"string"},duration:{type:"integer"},introduction:{type:"string"},
    questions:{type:"array",items:{type:"object",additionalProperties:false,properties:{
      question:{type:"string"},options:{type:"array",items:{type:"string"}},correct:{type:"integer"},explanation:{type:"string"},objective:{type:"string"},difficulty:{type:"string"},sourceIndexes:{type:"array",items:{type:"integer"}}
    },required:["question","options","correct","explanation","objective","difficulty","sourceIndexes"]}},
    sources:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},url:{type:"string"},publisher:{type:"string"}},required:["title","url","publisher"]}},
    quality:{type:"object",additionalProperties:false,properties:{score:{type:"integer"},factualConsistency:{type:"boolean"},noAmbiguity:{type:"boolean"},levelFit:{type:"boolean"},cleanFrench:{type:"boolean"},duplicateFree:{type:"boolean"},reviewSummary:{type:"string"}},required:["score","factualConsistency","noAmbiguity","levelFit","cleanFrench","duplicateFree","reviewSummary"]}
  },required:["title","type","theme","duration","introduction","questions","sources","quality"]};

  const instructions=`Tu es à la fois documentaliste et ingénieur pédagogique spécialisé dans la formation professionnelle des adultes.
Tu dois produire une activité exacte, claire, ludique et directement utilisable.

MÉTHODE OBLIGATOIRE :
1. Rechercher d’abord des informations récentes et fiables sur le thème.
2. Privilégier les sources primaires et reconnues : organismes publics, textes officiels, INRS, ministères, institutions, normes accessibles, universités et organismes professionnels reconnus.
3. Écarter les forums, contenus publicitaires, pages sans auteur et affirmations non vérifiables.
4. Croiser les informations importantes avec au moins deux sources lorsque cela est possible.
5. Ne créer aucune question si la bonne réponse n’est pas clairement soutenue par une source.
6. Rédiger une seule bonne réponse, sans piège de vocabulaire, sans double négation et sans ambiguïté.
7. Proposer des distracteurs plausibles mais incontestablement faux.
8. Adapter le français et la difficulté au public indiqué.
9. Vérifier : exactitude, doublons, orthographe, cohérence entre question/réponse/explication, validité de l’index correct.
10. Associer chaque question aux index des sources utilisées, puis effectuer une relecture finale et attribuer un score qualité réaliste.

Si les sources disponibles sont insuffisantes, réduis la portée des questions au lieu d’inventer. Chaque explication doit justifier la bonne réponse en français simple.`;

  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${secrets.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({
      model:secrets.OPENAI_MODEL||"gpt-5.6",
      store:false,
      reasoning:{effort:"medium"},
      tools:body.research===false?[]:[{type:"web_search"}],
      tool_choice:body.research===false?"auto":"required",
      include:body.research===false?[]:["web_search_call.action.sources"],
      instructions,
      input:`THÈME : ${theme}
OBJECTIF PÉDAGOGIQUE : ${body.objective||"Faire comprendre et appliquer les notions essentielles"}
PUBLIC : ${body.audience||"Adultes en formation professionnelle"}
NIVEAU : ${body.level||"Intermédiaire"}
FORMAT : ${type}
NOMBRE EXACT DE QUESTIONS : ${count}
PRÉCISIONS DU FORMATEUR : ${body.prompt||"Aucune"}

Construis le quiz uniquement après la recherche. Les sources doivent être directement liées aux réponses.`,
      text:{format:{type:"json_schema",name:"researched_pedagogical_activity",strict:true,schema}}
    })});
    if(!response.ok)throw new Error("OpenAI response failed");
    const data=await response.json() as {output_text?:string;output?:Array<{type?:string;action?:{sources?:Array<{url?:string;title?:string}>};content?:Array<{text?:string}>}>};
    const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).map(c=>c.text||"").join("")||"";
    const parsed=JSON.parse(raw) as Generated;
    const consulted=(data.output||[]).flatMap(item=>item.type==="web_search_call"?(item.action?.sources||[]):[]).filter(s=>s.url);
    if(consulted.length){
      const consultedUrls=new Set(consulted.map(s=>String(s.url)));
      const oldSources=parsed.sources||[];
      const verified=oldSources.filter(s=>consultedUrls.has(s.url));
      const verifiedUrls=new Map(verified.map((s,i)=>[s.url,i]));
      parsed.questions=(parsed.questions||[]).map(q=>({...q,sourceIndexes:(q.sourceIndexes||[]).map(i=>oldSources[i]?.url).filter((url):url is string=>Boolean(url)&&verifiedUrls.has(url)).map(url=>verifiedUrls.get(url) as number)}));
      parsed.sources=verified;
    }
    const activity=cleanActivity(parsed,count);
    if(activity.questions.length<count)throw new Error("Insufficient valid questions");
    return Response.json({activity,mode:"openai-research"});
  }catch{
    return Response.json({activity:fallback(theme,type,count),mode:"demo",notice:"La génération documentée n’a pas abouti. Un brouillon non publié a été créé pour révision."});
  }
}
