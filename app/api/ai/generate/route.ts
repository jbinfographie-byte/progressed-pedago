import { env } from "cloudflare:workers";

type Generated = { title:string; type:string; theme:string; duration:number; questions:Array<{ question:string; options:string[]; correct:number; explanation:string }> };

function fallback(prompt:string, type:string, count:number):Generated {
  const topic = prompt.trim() || "les bonnes pratiques professionnelles";
  const templates = [
    { question:`Quelle action doit être réalisée en premier concernant ${topic} ?`, options:["Observer la situation et préparer son action","Agir immédiatement sans consigne","Ignorer le protocole"], correct:0, explanation:"L’observation et la préparation sécurisent l’activité." },
    { question:`Quel comportement favorise le mieux l’apprentissage de ${topic} ?`, options:["Participer, tester et demander une correction","Mémoriser sans pratiquer","Éviter les échanges"], correct:0, explanation:"La pratique accompagnée consolide les compétences." },
    { question:"Comment vérifier que la consigne est comprise ?", options:["Faire reformuler ou démontrer","Répéter plus fort","Passer directement à la suite"], correct:0, explanation:"La reformulation permet de contrôler la compréhension." },
    { question:"Quel retour aide le plus à progresser ?", options:["Un retour précis avec un point fort et un axe d’amélioration","Une note sans explication","Une critique générale"], correct:0, explanation:"Un retour concret guide l’amélioration." },
    { question:"Que faut-il faire en cas d’erreur ?", options:["Analyser, corriger puis recommencer","Masquer l’erreur","Arrêter l’activité"], correct:0, explanation:"L’erreur devient une étape d’apprentissage." },
    { question:"Quelle conclusion est la plus utile ?", options:["Résumer l’essentiel et proposer un réinvestissement","Terminer sans synthèse","Ajouter une nouvelle notion complexe"], correct:0, explanation:"La synthèse aide à fixer les acquis." },
  ];
  return { title:`Défi : ${topic.slice(0,42)}`, type, theme:"Créé avec l’IA", duration:Math.max(8,count*2), questions:Array.from({length:count},(_,i)=>templates[i%templates.length]) };
}

export async function POST(request:Request) {
  const body = await request.json() as { prompt?:string; type?:string; count?:number; level?:string };
  const prompt = String(body.prompt||"").trim();
  const type = String(body.type||"Quiz interactif");
  const count = Math.min(10,Math.max(3,Number(body.count||5)));
  const secrets = env as unknown as { OPENAI_API_KEY?:string; OPENAI_MODEL?:string };
  if (!secrets.OPENAI_API_KEY) return Response.json({ activity:fallback(prompt,type,count), mode:"demo" });

  const schema = {
    type:"object", additionalProperties:false,
    properties:{
      title:{type:"string"}, type:{type:"string"}, theme:{type:"string"}, duration:{type:"integer"},
      questions:{type:"array",items:{type:"object",additionalProperties:false,properties:{
        question:{type:"string"}, options:{type:"array",items:{type:"string"}}, correct:{type:"integer"}, explanation:{type:"string"}
      },required:["question","options","correct","explanation"]}}
    },required:["title","type","theme","duration","questions"]
  };
  try {
    const response = await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${secrets.OPENAI_API_KEY}`,"Content-Type":"application/json" },
      body:JSON.stringify({
        model:secrets.OPENAI_MODEL||"gpt-5.6-luna",
        store:false,
        instructions:"Tu es ingénieur pédagogique pour adultes. Crée une activité ludique, claire, professionnelle et directement utilisable. Utilise un français simple. Les propositions incorrectes doivent rester plausibles. Le champ correct est l’index de la bonne réponse.",
        input:`Crée une activité de type ${type}, niveau ${body.level||"intermédiaire"}, avec exactement ${count} étapes sur : ${prompt}`,
        text:{ format:{ type:"json_schema", name:"pedagogical_activity", strict:true, schema } }
      })
    });
    if (!response.ok) throw new Error("OpenAI response failed");
    const data = await response.json() as { output_text?:string; output?:Array<{content?:Array<{text?:string}>}> };
    const raw = data.output_text || data.output?.flatMap(item=>item.content||[]).map(c=>c.text||"").join("") || "";
    return Response.json({ activity:JSON.parse(raw), mode:"openai" });
  } catch {
    return Response.json({ activity:fallback(prompt,type,count), mode:"demo" });
  }
}
