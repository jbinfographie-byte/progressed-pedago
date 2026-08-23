import { env } from "cloudflare:workers";
import { requireTrainer } from "@/app/auth";
import { getOpenAIConfig } from "@/app/ai-config";

type Source={title:string;url:string;publisher:string};
type Question={question:string;options:string[];correct:number;explanation:string;objective:string;difficulty:string;sourceIndexes:number[]};
type CourseSection={title:string;content:string;keyPoints:string[];example:string};
type CourseTable={title:string;headers:string[];rows:string[][]};
type CourseDiagram={title:string;steps:string[];caption:string};
type CourseExercise={title:string;instruction:string;expectedAnswer:string};
type GeneratedCourse={title:string;theme:string;duration:number;introduction:string;lesson:{title:string;summary:string;keyPoints:string[];steps:string[];learnerTip:string;hook:string;miniChallenge:string;memoryAid:string;sections:CourseSection[];tables:CourseTable[];diagrams:CourseDiagram[];exercises:CourseExercise[]};questions:Question[];sources:Source[];quality:{score:number;factualConsistency:boolean;noAmbiguity:boolean;levelFit:boolean;cleanFrench:boolean;duplicateFree:boolean;reviewSummary:string}};

const maxPdfBytes=15*1024*1024;

function toBase64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer);let binary="";const chunk=0x8000;
  for(let offset=0;offset<bytes.length;offset+=chunk)binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));
  return btoa(binary);
}

function fallbackCourse(theme:string,count:number,fileName?:string):GeneratedCourse{
  const topic=theme||fileName?.replace(/\.pdf$/i,"")||"le thème du document";
  const questions:Array<Question>=Array.from({length:count},(_,index)=>({question:index===0?`Quel est l’objectif principal à retenir concernant ${topic} ?`:`Quelle action permet d’appliquer correctement le point ${index+1} du cours ?`,options:["Observer, appliquer la méthode puis contrôler","Agir sans consulter les consignes","Supprimer l’étape de vérification"],correct:index%3,explanation:"La bonne pratique consiste à comprendre la consigne, appliquer la méthode et contrôler le résultat.",objective:"Vérifier la compréhension du cours",difficulty:"Intermédiaire",sourceIndexes:[]})).map(question=>{const answer=question.options[0];const rest=question.options.slice(1);const target=question.correct;const options=[...rest];options.splice(target,0,answer);return {...question,options}});
  return {title:`Cours complet : ${topic.slice(0,55)}`,theme:topic,duration:45,introduction:"Un parcours structuré pour découvrir, comprendre, pratiquer et vérifier les acquis.",lesson:{title:`Comprendre et appliquer ${topic}`,summary:`Ce cours transforme ${fileName?`le document « ${fileName} »`:"le thème indiqué"} en support pédagogique progressif. Vérifiez le contenu métier avant diffusion si l’analyse IA n’est pas configurée.`,keyPoints:["Identifier les notions essentielles","Relier chaque notion à une situation professionnelle","S’entraîner puis vérifier ses acquis"],steps:["Découvrir le vocabulaire et les objectifs","Étudier la méthode pas à pas","Réaliser les exercices","Terminer par le quiz"],learnerTip:"Avancez section par section et reformulez chaque idée avec vos propres mots.",hook:`Que savez-vous déjà sur ${topic} ?`,miniChallenge:"Citez une règle importante du cours et donnez un exemple d’application.",memoryAid:"Comprendre → Voir → Faire → Vérifier",sections:[{title:"1. Les notions essentielles",content:`Cette première partie présente les idées indispensables pour comprendre ${topic}. Elle doit être relue et adaptée au contexte professionnel du groupe.`,keyPoints:["Repérer les informations importantes","Distinguer les règles des exemples","Identifier les risques d’erreur"],example:"Demander à l’apprenant d’expliquer la notion avec une situation vécue."},{title:"2. La mise en pratique",content:"La progression pédagogique associe une démonstration, un essai guidé, une correction et un nouvel essai autonome.",keyPoints:["Montrer la méthode","Faire pratiquer","Corriger avec précision"],example:"Utiliser une situation professionnelle proche du poste de travail."}],tables:[{title:"Repères du cours",headers:["Étape","Action","Vérification"],rows:[["Préparer","Lire la consigne","Objectif compris"],["Réaliser","Appliquer la méthode","Ordre respecté"],["Contrôler","Observer le résultat","Écart corrigé"]]}],diagrams:[{title:"Parcours d’apprentissage",steps:["Découvrir","Comprendre","Pratiquer","Évaluer"],caption:"Une progression simple pour transformer les connaissances en compétences."}],exercises:[{title:"Exercice d’application",instruction:`Décrivez une situation dans laquelle vous utiliseriez les notions du cours sur ${topic}.`,expectedAnswer:"La réponse doit présenter le contexte, la méthode choisie et le contrôle final."}]},questions,sources:[],quality:{score:70,factualConsistency:true,noAmbiguity:true,levelFit:true,cleanFrench:true,duplicateFree:true,reviewSummary:"Brouillon de démonstration à relire : activez la connexion OpenAI pour analyser réellement le PDF."}};
}

export async function POST(request:Request){
  const unauthorized=await requireTrainer(request);if(unauthorized)return unauthorized;
  try{
    const form=await request.formData();
    const file=form.get("coursePdf");
    const pdf=file instanceof File&&file.size?file:null;
    const theme=String(form.get("theme")||"").trim();
    if(!theme&&!pdf)return Response.json({error:"Ajoutez un thème ou un PDF de cours."},{status:400});
    if(pdf&&pdf.type!=="application/pdf")return Response.json({error:"Le document source doit être au format PDF."},{status:415});
    if(pdf&&pdf.size>maxPdfBytes)return Response.json({error:"Le PDF ne doit pas dépasser 15 Mo."},{status:413});
    const count=Math.min(12,Math.max(3,Number(form.get("count")||8)));
    const primaryOutput=["course","quiz","activity"].includes(String(form.get("primaryOutput")))?String(form.get("primaryOutput")):"course";
    const addOns=form.getAll("addOns").map(String).filter(value=>["exercises","tables","diagrams"].includes(value));
    const validatedAnalysis=String(form.get("validatedAnalysis")||"").trim();
    if(pdf&&!validatedAnalysis)return Response.json({error:"Analysez le PDF puis validez au moins une page avant de lancer la création."},{status:400});
    const config=await getOpenAIConfig();
    let generated:GeneratedCourse;
    let mode="demo";

    if(config){
      const schema={type:"object",additionalProperties:false,properties:{title:{type:"string"},theme:{type:"string"},duration:{type:"integer"},introduction:{type:"string"},lesson:{type:"object",additionalProperties:false,properties:{title:{type:"string"},summary:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},steps:{type:"array",items:{type:"string"}},learnerTip:{type:"string"},hook:{type:"string"},miniChallenge:{type:"string"},memoryAid:{type:"string"},sections:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},content:{type:"string"},keyPoints:{type:"array",items:{type:"string"}},example:{type:"string"}},required:["title","content","keyPoints","example"]}},tables:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},headers:{type:"array",items:{type:"string"}},rows:{type:"array",items:{type:"array",items:{type:"string"}}}},required:["title","headers","rows"]}},diagrams:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},steps:{type:"array",items:{type:"string"}},caption:{type:"string"}},required:["title","steps","caption"]}},exercises:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},instruction:{type:"string"},expectedAnswer:{type:"string"}},required:["title","instruction","expectedAnswer"]}}},required:["title","summary","keyPoints","steps","learnerTip","hook","miniChallenge","memoryAid","sections","tables","diagrams","exercises"]},questions:{type:"array",items:{type:"object",additionalProperties:false,properties:{question:{type:"string"},options:{type:"array",items:{type:"string"}},correct:{type:"integer"},explanation:{type:"string"},objective:{type:"string"},difficulty:{type:"string"},sourceIndexes:{type:"array",items:{type:"integer"}}},required:["question","options","correct","explanation","objective","difficulty","sourceIndexes"]}},sources:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},url:{type:"string"},publisher:{type:"string"}},required:["title","url","publisher"]}},quality:{type:"object",additionalProperties:false,properties:{score:{type:"integer"},factualConsistency:{type:"boolean"},noAmbiguity:{type:"boolean"},levelFit:{type:"boolean"},cleanFrench:{type:"boolean"},duplicateFree:{type:"boolean"},reviewSummary:{type:"string"}},required:["score","factualConsistency","noAmbiguity","levelFit","cleanFrench","duplicateFree","reviewSummary"]}},required:["title","theme","duration","introduction","lesson","questions","sources","quality"]};
      const requestedPrimary=primaryOutput==="course"?"un cours complet":primaryOutput==="quiz"?"un quiz autonome":`une activité de type ${form.get("activityFormat")||"mise en situation"}`;
      const requestedAddOns=addOns.length?addOns.join(", "):"aucun support complémentaire";
      const prompt=`Crée ${requestedPrimary} pour adultes en formation professionnelle à partir des pages préalablement analysées et validées par le formateur. Analyse avec fidélité le PDF joint, mais utilise uniquement les pages conservées dans VALIDATION DU FORMATEUR. Ne déforme pas le document et reste dans son périmètre. Complète uniquement avec des sources institutionnelles fiables si la recherche est activée.\n\nPRODUCTION PRINCIPALE : ${requestedPrimary}\nCOMPLÉMENTS DEMANDÉS : ${requestedAddOns}\n- Si le cours n’est pas demandé, crée tout de même un résumé très court dans lesson mais laisse sections vide.\n- Si les tableaux ne sont pas demandés, retourne tables vide.\n- Si les schémas ne sont pas demandés, retourne diagrams vide.\n- Si les exercices ne sont pas demandés, retourne exercises vide.\n- Produis exactement ${count} questions pour le quiz final ou l’évaluation de l’activité. Chaque question doit avoir 3 ou 4 choix, une seule bonne réponse, des distracteurs plausibles et une explication. Mélange la position des bonnes réponses.\n- Français clair, adulte et professionnel.\n\nVALIDATION DU FORMATEUR : ${validatedAnalysis||"Aucune analyse préalable : travailler uniquement à partir du thème."}\n\nTHÈME : ${theme||"À déterminer à partir du PDF"}\nPUBLIC : ${form.get("audience")||"Adultes en formation professionnelle"}\nOBJECTIFS : ${form.get("objective")||"Identifier, comprendre et appliquer les notions essentielles"}\nDURÉE VISÉE : ${form.get("duration")||60} minutes\nCONSIGNES DU FORMATEUR : ${form.get("prompt")||"Contenu concret, progressif et directement utilisable"}`;
      const content:Array<Record<string,string>>=[];
      if(pdf)content.push({type:"input_file",filename:pdf.name,file_data:`data:application/pdf;base64,${toBase64(await pdf.arrayBuffer())}`});
      content.push({type:"input_text",text:prompt});
      const research=form.get("research")==="on";
      const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:config.model,store:false,reasoning:{effort:"medium"},tools:research?[{type:"web_search"}]:[],input:[{role:"user",content}],text:{format:{type:"json_schema",name:"complete_training_course",strict:true,schema}}})});
      if(!response.ok)throw new Error("L’analyse IA du PDF n’a pas abouti.");
      const data=await response.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>};
      const raw=data.output_text||data.output?.flatMap(item=>item.content||[]).map(item=>item.text||"").join("")||"";
      generated=JSON.parse(raw) as GeneratedCourse;mode="openai-pdf";
    }else return Response.json({error:"La connexion à l’intelligence artificielle n’est pas configurée. Ajoutez la clé OpenAI dans les réglages du site avant de générer le contenu."},{status:503});

    const startPosition=Math.floor(Math.random()*4);
    generated.questions=(generated.questions||[]).slice(0,count).map((question,index)=>{
      const options=(question.options||[]).map(String).filter(Boolean).slice(0,4);
      const correctIndex=Number.isInteger(question.correct)&&question.correct>=0&&question.correct<options.length?question.correct:0;
      const answer=options[correctIndex];const distractors=options.filter((_,optionIndex)=>optionIndex!==correctIndex);
      for(let i=distractors.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[distractors[i],distractors[j]]=[distractors[j],distractors[i]]}
      const target=(startPosition+index)%Math.max(options.length,1);const shuffled=[...distractors];shuffled.splice(target,0,answer);
      return {...question,options:shuffled,correct:target};
    }).filter(question=>question.options.length>=3&&question.explanation);
    if(generated.questions.length<3)return Response.json({error:"Le document ne contient pas assez d’éléments fiables pour produire le quiz demandé."},{status:422});

    let sourceDocument:undefined|{name:string;key:string;size:number;url:string};
    if(pdf&&env.BUCKET){
      const key=`course-sources/${crypto.randomUUID()}.pdf`;
      await env.BUCKET.put(key,await pdf.arrayBuffer(),{httpMetadata:{contentType:"application/pdf",contentDisposition:`inline; filename="${pdf.name.replace(/["\\]/g,"")}"`},customMetadata:{originalName:pdf.name.slice(0,120)}});
      sourceDocument={name:pdf.name,key,size:pdf.size,url:`/api/media/${encodeURIComponent(key)}`};
      generated.questions=(generated.questions||[]).map(question=>({...question,sourceIndexes:(question.sourceIndexes||[]).map(index=>index+1)}));
      generated.sources=[{title:pdf.name,url:sourceDocument.url,publisher:"Document PDF importé"},...(generated.sources||[])];
    }
    generated.lesson={...generated.lesson,sourceDocument} as typeof generated.lesson;
    const type=primaryOutput==="course"?"Cours complet":primaryOutput==="quiz"?"Quiz interactif":String(form.get("activityFormat")||"Activité pédagogique");
    return Response.json({activity:{...generated,type,lesson:generated.lesson,generationChoices:{primaryOutput,addOns}},mode});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Impossible de générer le cours."},{status:500})}
}
