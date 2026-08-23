"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Source={ title:string; url:string; publisher:string };
type Quality={ score?:number; factualConsistency?:boolean; noAmbiguity?:boolean; levelFit?:boolean; cleanFrench?:boolean; duplicateFree?:boolean; reviewSummary?:string };
type Question={ question:string; options:string[]; correct:number; explanation:string; objective?:string; difficulty?:string; sourceIndexes?:number[] };
type Activity={ id:number; title:string; type:string; theme:string; duration:number; questions:Question[]; color:string; source?:string; externalUrl?:string|null; sources?:Source[]; quality?:Quality; introduction?:string; coverImageUrl?:string|null; imageKey?:string|null; imageAlt?:string|null };
type Result={ id:number; learnerName:string; activityTitle:string; activityType:string; score:number; maxScore:number; durationSeconds:number; completedAt:string };
type Trainer={ email:string; role:"admin"|"trainer"; mustChangePassword:boolean };
type View="home"|"activities"|"results"|"connections"|"admin";

const formats=[
  {name:"Quiz interactif",icon:"?",text:"Questions, choix et correction instantanée",color:"mint"},
  {name:"Glisser-déposer",icon:"↕",text:"Classer, associer ou remettre dans l’ordre",color:"blue"},
  {name:"Vrai ou faux",icon:"✓",text:"Décider rapidement et argumenter",color:"coral"},
  {name:"Image interactive",icon:"◎",text:"Repérer des zones, risques ou matériels",color:"violet"},
  {name:"Mise en situation",icon:"◈",text:"Choisir une réaction dans un scénario",color:"sun"},
  {name:"Cartes mémoire",icon:"▣",text:"Mémoriser mots, gestes et définitions",color:"rose"},
  {name:"Sondage en direct",icon:"▥",text:"Faire participer tout le groupe",color:"aqua"},
  {name:"Roue du défi",icon:"✦",text:"Tirer au sort une mission ludique",color:"lime"},
];
const sampleQuestions:Question[]=[
  {question:"Quel est le premier réflexe avant de commencer l’activité ?",options:["Présenter l’objectif et les règles","Distribuer les réponses","Commencer sans consigne"],correct:0,explanation:"Une consigne claire sécurise les apprenants et facilite leur engagement."},
  {question:"Comment vérifier la compréhension ?",options:["Faire reformuler la consigne","Parler plus vite","Supprimer la pratique"],correct:0,explanation:"La reformulation permet de repérer immédiatement une incompréhension."},
  {question:"Quel retour aide le mieux à progresser ?",options:["Un retour précis et constructif","Une note seule","Aucun retour"],correct:0,explanation:"Un retour concret indique les acquis et le prochain axe de progrès."}
];
const starters:Activity[]=[
  {id:1,title:"Le chariot bien préparé",type:"Glisser-déposer",theme:"Propreté & hygiène",duration:12,questions:sampleQuestions,color:"mint"},
  {id:2,title:"Chasse aux risques",type:"Image interactive",theme:"Sécurité au travail",duration:15,questions:sampleQuestions,color:"coral"},
  {id:3,title:"Les raccourcis Word",type:"Quiz interactif",theme:"Compétences numériques",duration:8,questions:sampleQuestions,color:"blue"},
  {id:4,title:"Parler avec un résident",type:"Mise en situation",theme:"Français professionnel",duration:20,questions:sampleQuestions,color:"violet"},
];
const apps=[
  {name:"Canva",mark:"Ca",color:"#7856ff",text:"Intégrer vos présentations, fiches et jeux Canva"},
  {name:"Genially",mark:"Ge",color:"#ff4f64",text:"Ajouter vos contenus interactifs et escape games"},
  {name:"YouTube",mark:"▶",color:"#f13a3a",text:"Insérer une vidéo dans un parcours pédagogique"},
  {name:"Google Forms",mark:"G",color:"#6f55ca",text:"Relier un questionnaire ou une évaluation"},
  {name:"LearningApps",mark:"LA",color:"#2b79c2",text:"Centraliser vos exercices LearningApps"},
  {name:"Lien externe",mark:"↗",color:"#174d43",text:"Ajouter n’importe quelle ressource par son adresse"},
];

type IconName="home"|"book"|"game"|"chart"|"plus"|"search"|"bell"|"dots"|"play"|"spark"|"plug"|"download"|"users"|"wand"|"expand"|"upload"|"lock"|"logout"|"shield";
function Icon({name,size=20}:{name:IconName;size?:number}){
  const p:Record<IconName,React.ReactNode>={
    home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    book:<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z"/></>,
    game:<><path d="M8.5 6h7a6 6 0 0 1 5.8 7.5l-1.2 4.2a2.7 2.7 0 0 1-4.7 1l-1.1-1.4H9.7l-1.1 1.4a2.7 2.7 0 0 1-4.7-1l-1.2-4.2A6 6 0 0 1 8.5 6Z"/><path d="M7 11v4M5 13h4M16.5 12h.01M19 15h.01"/></>,
    chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    dots:<><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    play:<path d="m9 6 9 6-9 6Z" fill="currentColor"/>,spark:<><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    plug:<><path d="m12 22 4-4-3-3 3-3 3 3 3-4M8 2 4 6l3 3-3 3-3-3-1 1"/></>,download:<><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></>,
    users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    wand:<><path d="m15 4 5 5L8 21H3v-5Z"/><path d="m6 15 5 5M6 3v4M4 5h4M19 14v4M17 16h4"/></>,
    expand:<><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,
    upload:<><path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16"/></>,
    lock:<><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    logout:<><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5"/></>,
    shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>
}

export default function Home(){
  const [view,setView]=useState<View>("home");
  const [activities,setActivities]=useState(starters);
  const [results,setResults]=useState<Result[]>([]);
  const [query,setQuery]=useState("");
  const [creator,setCreator]=useState<"choice"|"manual"|"ai"|"external"|null>(null);
  const [playing,setPlaying]=useState<Activity|null>(null);
  const [step,setStep]=useState(0);
  const [answers,setAnswers]=useState<number[]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [finish,setFinish]=useState(false);
  const [saved,setSaved]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [generationStatus,setGenerationStatus]=useState("");
  const [toast,setToast]=useState("");
  const [printable,setPrintable]=useState<Activity|null>(null);
  const [trainer,setTrainer]=useState<Trainer|null>(null);
  const [authLoading,setAuthLoading]=useState(true);

  useEffect(()=>{fetch("/api/auth/session").then(async response=>{const data=await response.json();setTrainer(response.ok?data.trainer:null)}).catch(()=>setTrainer(null)).finally(()=>setAuthLoading(false))},[]);
  useEffect(()=>{if(!trainer)return; Promise.all([
    fetch("/api/activities").then(r=>r.json()).catch(()=>({activities:[]})),
    fetch("/api/results").then(r=>r.json()).catch(()=>({results:[]}))
  ]).then(([a,r])=>{ if(a.activities?.length)setActivities([...a.activities.map((x:Activity,i:number)=>({...x,color:formats[i%formats.length].color})),...starters]); setResults(r.results||[]) }) },[trainer]);
  useEffect(()=>{if(!printable)return;const previousTitle=document.title;document.title=`Activite-${printable.title.replace(/[^a-zA-Z0-9À-ÿ]+/g,"-")}`;const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setPrintable(null)};document.body.classList.add("print-preview-open");window.addEventListener("keydown",closeOnEscape);return()=>{document.title=previousTitle;document.body.classList.remove("print-preview-open");window.removeEventListener("keydown",closeOnEscape)}},[printable]);

  const filtered=useMemo(()=>activities.filter(a=>a.title.toLowerCase().includes(query.toLowerCase())||a.theme.toLowerCase().includes(query.toLowerCase())),[activities,query]);
  const average=results.length?Math.round(results.reduce((n,r)=>n+(r.score/r.maxScore)*100,0)/results.length):0;
  const score=answers.reduce((n,a,i)=>n+(a===(playing?.questions[i]?.correct??-1)?1:0),0)+(selected===(playing?.questions[step]?.correct??-2)&&finish?1:0);

  function notify(text:string){setToast(text);setTimeout(()=>setToast(""),2600)}
  async function uploadImage(value:FormDataEntryValue|null){
    if(!(value instanceof File)||!value.size)return {};
    const form=new FormData();form.append("image",value);
    const response=await fetch("/api/uploads",{method:"POST",body:form});const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Impossible d’ajouter l’image.");
    return {imageKey:data.key,imageAlt:value.name,coverImageUrl:data.url};
  }
  async function persistActivity(activity:Omit<Activity,"id"|"color">){
    const response=await fetch("/api/activities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(activity)});
    const data=await response.json();
    const created:Activity={...(data.activity||activity),id:data.activity?.id||Date.now(),color:formats.find(f=>f.name===activity.type)?.color||"mint"};
    setActivities(current=>[created,...current]);return created;
  }
  function start(activity:Activity){
    const base=Math.floor(Math.random()*4);
    const questions=activity.questions.map((q,index)=>{
      const correctText=q.options[q.correct];const distractors=q.options.filter((_,i)=>i!==q.correct);
      for(let i=distractors.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[distractors[i],distractors[j]]=[distractors[j],distractors[i]]}
      const target=(base+index)%q.options.length;const options=[...distractors];options.splice(target,0,correctText);
      return {...q,options,correct:target};
    });
    setPlaying({...activity,questions});setStep(0);setAnswers([]);setSelected(null);setFinish(false);setSaved(false)
  }
  function nextQuestion(){if(selected===null)return; if(!playing)return; if(step<playing.questions.length-1){setAnswers(a=>[...a,selected]);setStep(s=>s+1);setSelected(null)}else setFinish(true)}
  async function saveResult(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!playing)return; const name=String(new FormData(e.currentTarget).get("learnerName")||"");
    const finalAnswers=[...answers,selected??-1]; const finalScore=finalAnswers.reduce((n,a,i)=>n+(a===playing.questions[i].correct?1:0),0);
    const response=await fetch("/api/results",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({learnerName:name,activityTitle:playing.title,activityType:playing.type,score:finalScore,maxScore:playing.questions.length,durationSeconds:playing.duration*60,answers:finalAnswers})});
    const data=await response.json(); if(data.result)setResults(r=>[data.result,...r]); setSaved(true);
  }
  function exportCsv(){
    const rows=[["Nom","Activité","Type","Score","Pourcentage","Durée","Date"],...results.map(r=>[r.learnerName,r.activityTitle,r.activityType,`${r.score}/${r.maxScore}`,`${Math.round(r.score/r.maxScore*100)}%`,`${Math.round(r.durationSeconds/60)} min`,new Date(r.completedAt).toLocaleString("fr-FR")])];
    const csv="\uFEFF"+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="resultats-progressed-pedago.csv";a.click();URL.revokeObjectURL(url);
  }
  async function manualCreate(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const d=new FormData(e.currentTarget);try{const image=await uploadImage(d.get("image"));const activity=await persistActivity({title:String(d.get("title")),type:String(d.get("type")),theme:String(d.get("theme")),duration:Number(d.get("duration")),questions:sampleQuestions,source:"manual",...image});setCreator(null);notify(`« ${activity.title} » ajouté à la bibliothèque`)}catch(error){notify(error instanceof Error?error.message:"Image non enregistrée")}
  }
  async function aiCreate(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const d=new FormData(e.currentTarget);setGenerating(true);setGenerationStatus("Recherche des meilleures sources…");
    const response=await fetch("/api/ai/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({theme:d.get("theme"),objective:d.get("objective"),audience:d.get("audience"),prompt:d.get("prompt"),type:d.get("type"),count:d.get("count"),level:d.get("level"),research:d.get("research")==="on"})});
    setGenerationStatus("Vérification des questions et des réponses…");
    const data=await response.json();if(!response.ok){setGenerating(false);setGenerationStatus("");notify(data.error||"La génération n’a pas abouti");return}
    try{const image=await uploadImage(d.get("image"));const activity=await persistActivity({...data.activity,source:"ai",...image});setGenerating(false);setGenerationStatus("");setCreator(null);notify(data.mode==="openai-research"?`Quiz vérifié : ${activity.quality?.score||90}/100`:"Brouillon créé — sources à vérifier")}catch(error){setGenerating(false);setGenerationStatus("");notify(error instanceof Error?error.message:"Image non enregistrée")}
  }
  async function externalCreate(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const d=new FormData(e.currentTarget);await persistActivity({title:String(d.get("title")),type:"Ressource intégrée",theme:String(d.get("app")),duration:10,questions:sampleQuestions,source:"external",externalUrl:String(d.get("url"))});setCreator(null);notify("Ressource externe ajoutée");
  }

  async function logout(){await fetch("/api/auth/logout",{method:"POST"});setTrainer(null);setActivities(starters);setResults([]);setView("home")}

  if(authLoading)return <div className="auth-loading"><span className="brand-mark">P</span><div className="loader dark"/><p>Ouverture de votre espace sécurisé…</p></div>;
  if(!trainer)return <LoginScreen onAuthenticated={setTrainer}/>;
  if(trainer.mustChangePassword)return <ChangePasswordScreen trainer={trainer} onChanged={setTrainer} onLogout={logout}/>;
  const trainerName=trainer.email.split("@")[0].replace(/[._-]+/g," ");
  const initials=trainerName.split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase();

  return <><div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">P</span><span>Progressed<br/><b>Pédago</b></span></div>
      <nav aria-label="Navigation principale">
        <button onClick={()=>setView("home")} className={`nav-item ${view==="home"?"active":""}`}><Icon name="home"/>Tableau de bord</button>
        <button onClick={()=>setView("activities")} className={`nav-item ${view==="activities"?"active":""}`}><Icon name="game"/>Activités<span className="nav-count">{activities.length}</span></button>
        <button onClick={()=>setView("results")} className={`nav-item ${view==="results"?"active":""}`}><Icon name="chart"/>Résultats<span className="nav-count">{results.length}</span></button>
        <button onClick={()=>setView("connections")} className={`nav-item ${view==="connections"?"active":""}`}><Icon name="plug"/>Connexions</button>
        {trainer.role==="admin"&&<button onClick={()=>setView("admin")} className={`nav-item ${view==="admin"?"active":""}`}><Icon name="shield"/>Administration</button>}
      </nav>
      <div className="side-card"><Icon name="spark" size={24}/><strong>Assistant pédagogique IA</strong><p>Décrivez une idée : l’assistant prépare le jeu, les réponses et les corrections.</p><button onClick={()=>setCreator("ai")}>Créer avec l’IA</button></div>
      <div className="profile"><span className="avatar">{initials||"F"}</span><div><strong>{trainerName}</strong><small>{trainer.email}</small></div><button onClick={logout} title="Se déconnecter" aria-label="Se déconnecter"><Icon name="logout" size={18}/></button></div>
    </aside>
    <main>
      <header className="topbar"><div><p className="eyebrow">{view==="admin"?"PILOTAGE SÉCURITÉ":"ESPACE FORMATEUR"}</p><h1>{view==="home"?`Bonjour ${trainerName}, prêt à transmettre ?`:view==="activities"?"Ma fabrique d’activités":view==="results"?"Résultats des apprenants":view==="connections"?"Applications connectées":"Administration de l’espace"}</h1></div><div className="top-actions">{(view==="home"||view==="activities")&&<label className="search"><Icon name="search" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher…"/></label>}<button className="icon-button" aria-label="Notifications"><Icon name="bell"/></button>{view!=="admin"&&<button className="primary" onClick={()=>setCreator("choice")}><Icon name="plus" size={18}/>Créer une activité</button>}</div></header>

      {view==="home"&&<>
        <section className="hero-panel ai-hero"><div><span className="pill"><Icon name="wand" size={14}/>CRÉATION ASSISTÉE PAR CHATGPT</span><h2>Une idée devient un jeu.</h2><p>Écrivez votre objectif en quelques mots. L’assistant construit les questions, les réponses, les consignes et les explications.</p><button onClick={()=>setCreator("ai")}>Essayer l’atelier IA <span>→</span></button></div><div className="prompt-preview"><span>Votre demande</span><p>« Crée un glisser-déposer sur la préparation d’un chariot de nettoyage… »</p><div><i/><i/><i/><b>Activité prête ✓</b></div></div></section>
        <section className="quick-stats"><article><span className="stat-icon green"><Icon name="game"/></span><div><strong>{activities.length}</strong><small>activités disponibles</small></div></article><article><span className="stat-icon purple"><Icon name="users"/></span><div><strong>{results.length}</strong><small>participations reçues</small></div></article><article><span className="stat-icon yellow"><Icon name="chart"/></span><div><strong>{average}%</strong><small>réussite moyenne</small></div></article><article><span className="stat-icon pink"><Icon name="plug"/></span><div><strong>{apps.length}</strong><small>applications intégrables</small></div></article></section>
        <section className="section-block"><div className="section-heading"><div><span className="kicker">CHOISIR UN FORMAT</span><h2>Des activités pour chaque moment</h2></div><button className="text-button" onClick={()=>setView("activities")}>Voir tous les formats →</button></div><div className="format-strip">{formats.slice(0,4).map(f=><button key={f.name} onClick={()=>setCreator("manual")} className={`format-card ${f.color}`}><span>{f.icon}</span><strong>{f.name}</strong><small>{f.text}</small><b>Créer →</b></button>)}</div></section>
        <ActivityLibrary activities={filtered.slice(0,4)} start={start} print={setPrintable} onCreate={()=>setCreator("choice")}/>
      </>}

      {view==="activities"&&<>
        <section className="studio-banner"><div><span className="pill"><Icon name="spark" size={14}/>FABRIQUE LUDIQUE</span><h2>Comment voulez-vous commencer ?</h2><p>Partez d’un modèle, décrivez votre idée à l’IA ou intégrez une ressource existante.</p></div><div className="studio-actions"><button onClick={()=>setCreator("ai")}><Icon name="wand"/><strong>Générer avec l’IA</strong><small>À partir d’un prompt</small></button><button onClick={()=>setCreator("manual")}><Icon name="plus"/><strong>Créer manuellement</strong><small>À partir d’un format</small></button><button onClick={()=>setCreator("external")}><Icon name="plug"/><strong>Importer un contenu</strong><small>Canva, Genially, lien…</small></button></div></section>
        <section className="section-block"><div className="section-heading"><div><span className="kicker">8 FORMATS LUDIQUES</span><h2>Choisir une mécanique de jeu</h2></div></div><div className="all-formats">{formats.map(f=><button key={f.name} onClick={()=>setCreator("manual")} className={`format-tile ${f.color}`}><span>{f.icon}</span><div><strong>{f.name}</strong><small>{f.text}</small></div><b>→</b></button>)}</div></section>
        <ActivityLibrary activities={filtered} start={start} print={setPrintable} onCreate={()=>setCreator("choice")}/>
      </>}

      {view==="results"&&<section className="results-page">
        <div className="results-toolbar"><div><span className="kicker">SUIVI PÉDAGOGIQUE</span><h2>Vue d’ensemble</h2><p>Chaque apprenant renseigne son nom à la fin de l’activité. Son résultat apparaît ici.</p></div><div><button onClick={exportCsv}><Icon name="download" size={17}/>Exporter pour Excel</button><button onClick={()=>window.print()}><Icon name="download" size={17}/>Exporter en PDF</button></div></div>
        <div className="result-cards"><article><small>Participations</small><strong>{results.length}</strong><span>résultats enregistrés</span></article><article><small>Réussite moyenne</small><strong>{average}%</strong><div className="meter"><i style={{width:`${average}%`}}/></div></article><article><small>Apprenants actifs</small><strong>{new Set(results.map(r=>r.learnerName)).size}</strong><span>noms différents</span></article></div>
        <div className="result-table-wrap"><div className="table-title"><h3>Derniers résultats</h3><span>{results.length} participation{results.length>1?"s":""}</span></div><table><thead><tr><th>Apprenant</th><th>Activité</th><th>Format</th><th>Score</th><th>Réussite</th><th>Date</th></tr></thead><tbody>{results.map(r=><tr key={r.id}><td><span className="mini-avatar">{r.learnerName.slice(0,2).toUpperCase()}</span><b>{r.learnerName}</b></td><td>{r.activityTitle}</td><td><span className="type-badge">{r.activityType}</span></td><td>{r.score}/{r.maxScore}</td><td><b className={r.score/r.maxScore>=.7?"success":"warning"}>{Math.round(r.score/r.maxScore*100)}%</b></td><td>{new Date(r.completedAt).toLocaleDateString("fr-FR")}</td></tr>)}{!results.length&&<tr><td colSpan={6}><div className="no-results"><Icon name="users" size={30}/><strong>Aucun résultat pour le moment</strong><span>Lancez une activité test pour découvrir le suivi.</span></div></td></tr>}</tbody></table></div>
      </section>}

      {view==="connections"&&<section className="connections-page"><div className="connection-intro"><div><span className="pill"><Icon name="plug" size={14}/>CENTRE DE CONNEXIONS</span><h2>Réunissez tous vos outils pédagogiques.</h2><p>Ajoutez vos contenus existants dans Progressed Pédago. L’apprenant retrouve tout dans un même parcours.</p></div><button onClick={()=>setCreator("external")}><Icon name="plus"/>Ajouter une ressource</button></div><div className="apps-grid">{apps.map(app=><article key={app.name}><span style={{background:app.color}}>{app.mark}</span><div><h3>{app.name}</h3><p>{app.text}</p></div><button onClick={()=>setCreator("external")}>Connecter</button></article>)}</div><div className="embed-tip"><Icon name="spark"/><div><strong>Une application n’est pas dans la liste ?</strong><p>Copiez son lien de partage ou son code d’intégration. Progressed Pédago peut la présenter dans votre bibliothèque.</p></div><button onClick={()=>setCreator("external")}>Ajouter par lien →</button></div></section>}
      {view==="admin"&&trainer.role==="admin"&&<AdminPanel/>}
    </main>

    {creator&&<Creator mode={creator} setMode={setCreator} manualCreate={manualCreate} aiCreate={aiCreate} externalCreate={externalCreate} generating={generating} generationStatus={generationStatus}/>}
    {playing&&<Player activity={playing} step={step} selected={selected} setSelected={setSelected} finish={finish} score={score} next={nextQuestion} close={()=>setPlaying(null)} save={saveResult} saved={saved}/>}
    {toast&&<div className="toast"><span>✓</span>{toast}</div>}
  </div>{printable&&<PrintPreview activity={printable} onClose={()=>setPrintable(null)}/>}</>
}

function LoginScreen({onAuthenticated}:{onAuthenticated:(trainer:Trainer)=>void}){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [password,setPassword]=useState("");const [pendingEmail,setPendingEmail]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setLoading(true);setError("");const data=new FormData(e.currentTarget);
    if(mode==="register"&&password!==String(data.get("confirmation")||"")){setError("Les deux mots de passe ne correspondent pas.");setLoading(false);return}
    try{const response=await fetch(`/api/auth/${mode==="login"?"login":"register"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:data.get("email"),password})});const body=await response.json();if(body.verificationRequired){setPendingEmail(String(body.email||data.get("email")));setError("");return}if(!response.ok)throw new Error(body.error||"Accès refusé.");onAuthenticated(body.trainer)}catch(reason){setError(reason instanceof Error?reason.message:"Accès refusé.")}finally{setLoading(false)}
  }
  if(pendingEmail)return <VerifyEmailScreen email={pendingEmail} onAuthenticated={onAuthenticated} onBack={()=>{setPendingEmail("");setMode("login");setPassword("")}}/>;
  return <main className="login-page">
    <section className="login-story"><div className="login-brand"><span className="brand-mark">P</span><span>Progressed<br/><b>Pédago</b></span></div><span className="secure-pill"><Icon name="lock" size={15}/> ESPACE FORMATEUR SÉCURISÉ</span><h1>Vos activités pédagogiques, dans un espace protégé.</h1><p>Créez vos jeux, utilisez l’intelligence artificielle et retrouvez les résultats de vos apprenants en toute simplicité.</p><div className="login-benefits"><span>✓ Accès personnel</span><span>✓ Mot de passe protégé</span><span>✓ E-mail validé</span></div></section>
    <section className="login-panel"><div className="login-card"><div className="login-icon"><Icon name="lock" size={25}/></div><span className="kicker">{mode==="login"?"BON RETOUR":"PREMIER ACCÈS"}</span><h2>{mode==="login"?"Ouvrir mon espace":"Créer mon accès formateur"}</h2><p>{mode==="login"?"Saisissez votre e-mail et votre mot de passe.":"Créez un mot de passe sécurisé avec des lettres, des majuscules, des chiffres et, si vous le souhaitez, des caractères spéciaux."}</p><form onSubmit={submit}><label>Adresse e-mail<input type="email" name="email" autoComplete="email" placeholder="formateur@exemple.fr" required/></label><label>Mot de passe<input type="password" name="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={mode==="register"?12:1} maxLength={128} autoComplete={mode==="login"?"current-password":"new-password"} placeholder={mode==="register"?"Exemple : Formation2026!":"Votre mot de passe"} required/>{mode==="register"&&<><div className={`password-strength s${passwordStrength(password)}`}><i/><i/><i/><i/></div><div className="password-rules"><span className={password.length>=12?"ok":""}>✓ 12 caractères</span><span className={/[A-ZÀ-ÖØ-Þ]/.test(password)?"ok":""}>✓ Une majuscule</span><span className={/\d/.test(password)?"ok":""}>✓ Un chiffre</span></div></>}</label>{mode==="register"&&<label>Confirmer le mot de passe<input type="password" name="confirmation" minLength={12} maxLength={128} autoComplete="new-password" placeholder="Retapez votre mot de passe" required/></label>}{error&&<div className="auth-error">{error}</div>}<button className="auth-submit" disabled={loading}>{loading?<><span className="loader"/>Vérification…</>:mode==="login"?<>Accéder à mon espace <span>→</span></>:<>Créer et valider mon accès <span>→</span></>}</button></form><div className="auth-switch"><span>{mode==="login"?"Première visite ?":"Vous avez déjà un accès ?"}</span><button onClick={()=>{setMode(mode==="login"?"register":"login");setPassword("");setError("")}}>{mode==="login"?"Créer un accès formateur":"Me connecter"}</button></div><small className="privacy-note"><Icon name="lock" size={12}/> Votre mot de passe est protégé et n’est jamais envoyé par e-mail.</small></div>
    </section>
  </main>
}

function VerifyEmailScreen({email,onAuthenticated,onBack}:{email:string;onAuthenticated:(trainer:Trainer)=>void;onBack:()=>void}){
  const [code,setCode]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("Un code à 6 chiffres a été envoyé à votre adresse e-mail.");const [loading,setLoading]=useState(false);
  async function verify(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError("");try{const response=await fetch("/api/auth/verify-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code})});const body=await response.json();if(!response.ok)throw new Error(body.error);onAuthenticated(body.trainer)}catch(reason){setError(reason instanceof Error?reason.message:"Validation impossible.")}finally{setLoading(false)}}
  async function resend(){setLoading(true);setError("");const response=await fetch("/api/auth/resend-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const body=await response.json();if(response.ok)setMessage(body.message);else setError(body.error||"Envoi impossible.");setLoading(false)}
  return <main className="password-page"><section className="login-card verification-card"><div className="login-icon"><Icon name="shield" size={25}/></div><span className="kicker">VALIDATION DE L’ADRESSE</span><h2>Consultez votre e-mail</h2><p>{message}</p><strong className="verification-email">{email}</strong><form onSubmit={verify}><label>Code de validation<input className="verification-code" type="text" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="000000" required/></label>{error&&<div className="auth-error">{error}</div>}<button className="auth-submit" disabled={loading||code.length!==6}>{loading?"Validation…":"Valider mon espace"}</button></form><div className="verification-actions"><button onClick={resend} disabled={loading}>Renvoyer le code</button><button onClick={onBack}>Changer d’adresse</button></div><small className="privacy-note"><Icon name="lock" size={12}/> Le code expire après 15 minutes.</small></section></main>
}

function passwordStrength(password:string){let score=0;if(password.length>=12)score++;if(password.length>=16)score++;if(/[a-z]/.test(password)&&/[A-Z]/.test(password))score++;if(/\d/.test(password)||/[^A-Za-z0-9]/.test(password))score++;return Math.min(4,score)}

function ChangePasswordScreen({trainer,onChanged,onLogout}:{trainer:Trainer;onChanged:(trainer:Trainer)=>void;onLogout:()=>void}){
  const [error,setError]=useState("");const [loading,setLoading]=useState(false);const [password,setPassword]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);if(password!==String(data.get("confirmation")||"")){setError("Les deux nouveaux mots de passe ne correspondent pas.");return}setLoading(true);setError("");try{const response=await fetch("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword:data.get("currentPassword"),newPassword:password})});const body=await response.json();if(!response.ok)throw new Error(body.error);onChanged(body.trainer)}catch(reason){setError(reason instanceof Error?reason.message:"Modification impossible.")}finally{setLoading(false)}}
  return <main className="password-page"><section className="login-card"><div className="login-icon"><Icon name="shield" size={25}/></div><span className="kicker">SÉCURITÉ DU COMPTE</span><h2>Choisissez un nouveau mot de passe</h2><p>Votre ancien code doit être remplacé par un mot de passe d’au moins 12 caractères.</p><form onSubmit={submit}><label>Mot de passe actuel<input type="password" name="currentPassword" autoComplete="current-password" required/></label><label>Nouveau mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required/><div className={`password-strength s${passwordStrength(password)}`}><i/><i/><i/><i/></div></label><label>Confirmer<input type="password" name="confirmation" minLength={12} maxLength={128} autoComplete="new-password" required/></label>{error&&<div className="auth-error">{error}</div>}<button className="auth-submit" disabled={loading}>{loading?"Modification…":"Enregistrer le nouveau mot de passe"}</button></form><button className="logout-link" onClick={onLogout}>Se déconnecter</button><small>{trainer.email}</small></section></main>
}

type AdminAccount={id:number;email:string;role:string;status:string;emailVerified:boolean;failedAttempts:number;lockedUntil:string|null;lastLoginAt:string|null;mustChangePassword:boolean;createdAt:string};
type AdminEvent={id:number;email:string;event:string;detail:string|null;createdAt:string};
function AdminPanel(){
  const [accounts,setAccounts]=useState<AdminAccount[]>([]);const [events,setEvents]=useState<AdminEvent[]>([]);const [registration,setRegistration]=useState(true);const [emailConfigured,setEmailConfigured]=useState(false);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");
  async function load(){setLoading(true);const response=await fetch("/api/admin");const data=await response.json();if(response.ok){setAccounts(data.accounts);setEvents(data.events);setRegistration(data.settings.registrationEnabled);setEmailConfigured(data.settings.emailConfigured)}else setMessage(data.error||"Chargement impossible");setLoading(false)}
  useEffect(()=>{load()},[]);
  async function action(payload:Record<string,unknown>,success:string){const response=await fetch("/api/admin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();setMessage(response.ok?success:(data.error||"Action impossible"));if(response.ok)await load()}
  function resetPassword(account:AdminAccount){const password=window.prompt(`Nouveau mot de passe temporaire pour ${account.email} (12 caractères minimum) :`);if(password)action({action:"reset-password",trainerId:account.id,password},"Mot de passe temporaire enregistré. Le formateur devra le modifier.")}
  const locked=accounts.filter(a=>a.lockedUntil&&new Date(a.lockedUntil)>new Date()).length;
  return <section className="admin-page"><div className="admin-intro"><div><span className="pill"><Icon name="shield" size={14}/> CENTRE DE CONTRÔLE</span><h2>Comptes et sécurité</h2><p>Gérez les accès des formateurs et repérez rapidement les problèmes de connexion.</p></div><label className="registration-switch"><span><b>Nouvelles inscriptions</b><small>{registration?"Autorisées":"Suspendues"}</small></span><input type="checkbox" checked={registration} onChange={e=>action({action:"registration",enabled:e.target.checked},e.target.checked?"Inscriptions ouvertes":"Inscriptions fermées")}/><i/></label></div>{!emailConfigured&&<div className="email-warning"><Icon name="bell"/><div><b>Validation par e-mail à configurer</b><p>Les nouveaux comptes formateurs resteront bloqués tant que le service d’envoi d’e-mails n’est pas relié.</p></div></div>}<div className="admin-stats"><article><span className="stat-icon green"><Icon name="users"/></span><div><strong>{accounts.length}</strong><small>comptes formateurs</small></div></article><article><span className="stat-icon purple"><Icon name="shield"/></span><div><strong>{accounts.filter(a=>a.status==="active").length}</strong><small>comptes actifs</small></div></article><article><span className="stat-icon pink"><Icon name="lock"/></span><div><strong>{locked}</strong><small>comptes verrouillés</small></div></article></div>{message&&<div className="admin-message">{message}</div>}{loading?<div className="admin-loading"><span className="loader dark"/>Chargement…</div>:<><div className="admin-table"><div className="table-title"><h3>Gestion des comptes</h3><span>{accounts.length} compte{accounts.length>1?"s":""}</span></div><table><thead><tr><th>Formateur</th><th>Rôle</th><th>État</th><th>Dernière connexion</th><th>Actions</th></tr></thead><tbody>{accounts.map(account=><tr key={account.id}><td><b>{account.email}</b>{!account.emailVerified&&<small>Adresse non validée</small>}{account.mustChangePassword&&<small>Mot de passe à renouveler</small>}</td><td><span className={`role-badge ${account.role}`}>{account.role==="admin"?"Administrateur":"Formateur"}</span></td><td><span className={`status-dot ${account.status}`}>{account.status==="active"?"Actif":account.status==="pending"?"En attente":"Désactivé"}</span></td><td>{account.lastLoginAt?new Date(account.lastLoginAt).toLocaleString("fr-FR"):"Jamais"}</td><td><div className="admin-actions"><button onClick={()=>resetPassword(account)}>Réinitialiser</button><button className={account.status==="active"?"danger":""} onClick={()=>action({action:"status",trainerId:account.id,status:account.status==="active"?"inactive":"active"},account.status==="active"?"Compte désactivé":"Compte réactivé")}>{account.status==="active"?"Désactiver":"Réactiver"}</button></div></td></tr>)}</tbody></table></div><div className="security-log"><div className="table-title"><h3>Journal de sécurité</h3><span>50 derniers événements</span></div>{events.length?events.map(event=><article key={event.id}><span className={`event-mark ${event.event.includes("failed")?"alert":""}`}><Icon name={event.event.includes("failed")?"lock":"shield"} size={15}/></span><div><b>{event.email}</b><p>{eventLabel(event.event)}{event.detail?` — ${event.detail}`:""}</p></div><time>{new Date(event.createdAt).toLocaleString("fr-FR")}</time></article>):<p className="empty-log">Aucun événement de sécurité enregistré.</p>}</div></>}</section>
}
function eventLabel(event:string){return ({account_created:"Compte créé",verification_sent:"E-mail de validation envoyé",verification_resent:"Code de validation renvoyé",verification_failed:"Code de validation incorrect",email_verified:"Adresse e-mail validée",login_success:"Connexion réussie",login_failed:"Échec de connexion",password_changed:"Mot de passe modifié",password_reset:"Mot de passe réinitialisé",account_enabled:"Compte réactivé",account_disabled:"Compte désactivé",setting_changed:"Réglage modifié"} as Record<string,string>)[event]||event}

function ActivityLibrary({activities,start,print,onCreate}:{activities:Activity[];start:(a:Activity)=>void;print:(a:Activity)=>void;onCreate:()=>void}){
  return <section className="section-block games-section"><div className="section-heading"><div><span className="kicker">VOTRE BIBLIOTHÈQUE</span><h2>Activités prêtes à animer</h2></div><button className="text-button" onClick={onCreate}>+ Nouvelle activité</button></div><div className="game-grid">{activities.map(a=><article className="game-card" key={`${a.id}-${a.title}`}><div className={`game-cover ${a.color} ${a.coverImageUrl?"with-image":""}`}>{a.coverImageUrl&&<img src={a.coverImageUrl} alt={a.imageAlt||`Illustration de ${a.title}`}/>}<span className="game-type">{a.source==="ai"?"✦ Créé avec l’IA":a.type}</span>{a.source==="ai"&&<span className={`quality-badge ${(a.quality?.score||0)>=85?"verified":"draft"}`}>{(a.quality?.score||0)>=85?"✓ Vérifié":"À relire"}</span>}<div className="game-symbol">{!a.coverImageUrl&&(formats.find(f=>f.name===a.type)?.icon||"▶")}</div><button className="play-button" onClick={()=>start(a)} aria-label={`Jouer à ${a.title} en grand écran`}><Icon name="expand" size={17}/></button></div><div className="game-content"><span>{a.theme}</span><h3>{a.title}</h3>{a.sources?.length?<p className="source-count">{a.sources.length} source{a.sources.length>1?"s":""} consultée{a.sources.length>1?"s":""} • Qualité {a.quality?.score||"—"}/100</p>:null}<div className="game-meta"><small>{a.duration} min</small><small>{a.questions.length} étapes</small><button className="pdf-button" onClick={()=>print(a)} aria-label={`Générer ${a.title} au format PDF A4`}><Icon name="download" size={14}/>PDF A4</button></div></div></article>)}</div></section>
}

function PrintableActivity({activity}:{activity:Activity}){
  const instruction=activity.type==="Glisser-déposer"?"Pour chaque question, indiquez la lettre correspondant à la bonne proposition.":activity.type==="Vrai ou faux"?"Cochez la proposition correcte pour chaque affirmation.":activity.type==="Mise en situation"?"Lisez chaque situation, puis cochez la réponse professionnelle la plus adaptée.":"Lisez chaque question, puis cochez une seule réponse.";
  return <section className="print-document"><article className="print-page learner-sheet"><header className="print-header"><div className="print-logo">P</div><div><b>Progressed Pédago</b><span>Fiche d’activité apprenant</span></div><em>{activity.type}</em></header><div className="print-title"><span>{activity.theme}</span><h1>{activity.title}</h1><p>{activity.introduction||instruction}</p></div>{activity.coverImageUrl&&<img className="print-cover" src={activity.coverImageUrl} alt=""/>}<div className="identity-lines"><p>Nom et prénom : <span/></p><p>Date : <span/></p></div><div className="print-info"><span><b>Durée</b>{activity.duration} minutes</span><span><b>Questions</b>{activity.questions.length}</span><span><b>Consigne</b>{instruction}</span></div><div className="print-questions">{activity.questions.map((question,index)=><section className="print-question" key={`${index}-${question.question}`}><div className="print-number">{index+1}</div><div><h2>{question.question}</h2>{question.objective&&<p className="print-objective">Objectif : {question.objective}</p>}<ul>{question.options.map((option,optionIndex)=><li key={`${optionIndex}-${option}`}><i/><b>{String.fromCharCode(65+optionIndex)}</b><span>{option}</span></li>)}</ul><p className="paper-answer">Réponse : <span/></p></div></section>)}</div><footer className="print-footer"><span>Progressed Solution • Support pédagogique</span><span>Document apprenant</span></footer></article><article className="print-page answer-sheet"><header className="print-header"><div className="print-logo">P</div><div><b>Progressed Pédago</b><span>Corrigé formateur</span></div><em>CORRIGÉ</em></header><div className="print-title compact"><span>{activity.theme}</span><h1>{activity.title}</h1><p>Réponses attendues et explications pédagogiques.</p></div><div className="correction-list">{activity.questions.map((question,index)=><section className="correction-item" key={`${index}-${question.question}`}><div className="print-number">{index+1}</div><div><h2>{question.question}</h2><p className="correct-answer"><b>Bonne réponse : {String.fromCharCode(65+question.correct)}</b> — {question.options[question.correct]}</p><p>{question.explanation}</p></div></section>)}</div>{activity.sources?.length?<div className="print-sources"><h2>Sources utilisées</h2>{activity.sources.map((source,index)=><p key={source.url}>{index+1}. {source.publisher||source.title} — {source.url}</p>)}</div>:null}<footer className="print-footer"><span>Progressed Solution • Support pédagogique</span><span>Corrigé formateur</span></footer></article></section>
}

function PrintPreview({activity,onClose}:{activity:Activity;onClose:()=>void}){
  return <div className="print-preview-overlay" role="dialog" aria-modal="true" aria-label={`Aperçu PDF de ${activity.title}`}><header className="print-preview-toolbar"><div><span className="kicker">APERÇU AVANT IMPRESSION</span><b>{activity.title}</b><small>La fiche apprenant et le corrigé seront enregistrés ensemble.</small></div><div><button className="preview-close" onClick={onClose}>Fermer</button><button className="preview-print" onClick={()=>window.print()}><Icon name="download" size={17}/>Imprimer ou enregistrer en PDF</button></div></header><main className="print-preview-scroll"><PrintableActivity activity={activity}/></main></div>
}

function Creator({mode,setMode,manualCreate,aiCreate,externalCreate,generating,generationStatus}:{mode:string;setMode:(m:"choice"|"manual"|"ai"|"external"|null)=>void;manualCreate:(e:FormEvent<HTMLFormElement>)=>void;aiCreate:(e:FormEvent<HTMLFormElement>)=>void;externalCreate:(e:FormEvent<HTMLFormElement>)=>void;generating:boolean;generationStatus:string}){
  return <div className="modal-backdrop" onMouseDown={()=>setMode(null)}><section className="modal creator-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><button className="modal-close" onClick={()=>setMode(null)}>×</button>
    {mode==="choice"&&<><span className="modal-icon"><Icon name="plus"/></span><p className="eyebrow">NOUVELLE ACTIVITÉ</p><h2>Comment souhaitez-vous créer ?</h2><p className="modal-intro">Choisissez le point de départ le plus simple pour vous.</p><div className="creation-choices"><button onClick={()=>setMode("ai")}><span><Icon name="wand"/></span><div><strong>Créer avec ChatGPT</strong><small>Décrivez le résultat attendu en langage simple</small></div><b>→</b></button><button onClick={()=>setMode("manual")}><span><Icon name="game"/></span><div><strong>Construire manuellement</strong><small>Choisissez un format puis personnalisez-le</small></div><b>→</b></button><button onClick={()=>setMode("external")}><span><Icon name="plug"/></span><div><strong>Intégrer une application</strong><small>Canva, Genially, YouTube ou autre lien</small></div><b>→</b></button></div></>}
    {mode==="manual"&&<><button className="back-link" onClick={()=>setMode("choice")}>← Retour</button><span className="modal-icon"><Icon name="game"/></span><p className="eyebrow">CRÉATION MANUELLE</p><h2>Préparer une activité</h2><form onSubmit={manualCreate}><label>Titre<input name="title" required placeholder="Ex. Classer les EPI selon le risque"/></label><div className="form-row"><label>Format<select name="type">{formats.map(f=><option key={f.name}>{f.name}</option>)}</select></label><label>Thématique<select name="theme"><option>Propreté & hygiène</option><option>Sécurité au travail</option><option>Compétences numériques</option><option>Français professionnel</option></select></label></div><label>Durée estimée<input name="duration" type="number" min="3" max="60" defaultValue="10"/></label><ImageInput/><div className="modal-actions"><button type="button" onClick={()=>setMode(null)}>Annuler</button><button className="primary">Créer le brouillon →</button></div></form></>}
    {mode==="ai"&&<><button className="back-link" onClick={()=>setMode("choice")}>← Retour</button><span className="modal-icon ai"><Icon name="wand"/></span><p className="eyebrow">ASSISTANT DOCUMENTÉ CHATGPT</p><h2>Créer un quiz à partir d’un thème.</h2><p className="modal-intro">L’assistant recherche d’abord des références fiables, construit le quiz, puis vérifie chaque réponse et la qualité de la formulation.</p><form onSubmit={aiCreate}>
      <label>Thème principal *<input name="theme" required placeholder="Ex. Les risques chimiques dans le secteur de la propreté"/></label>
      <label>Objectif pédagogique *<input name="objective" required placeholder="Ex. Identifier les pictogrammes et appliquer les protections adaptées"/></label>
      <div className="form-row"><label>Public concerné<input name="audience" required placeholder="Ex. Agents de propreté débutants"/></label><label>Niveau<select name="level"><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option></select></label></div>
      <label>Précisions facultatives<textarea name="prompt" placeholder="Ex. Utiliser un français simple, prévoir des situations de chantier et éviter les questions uniquement théoriques."/></label>
      <div className="form-row"><label>Format<select name="type">{formats.slice(0,6).map(f=><option key={f.name}>{f.name}</option>)}</select></label><label>Nombre de questions<select name="count"><option>5</option><option>8</option><option>10</option></select></label></div>
      <ImageInput/>
      <label className="research-toggle"><input type="checkbox" name="research" defaultChecked/><span><b>Rechercher et croiser les sources</b><small>Priorité aux organismes publics, textes officiels, institutions et organismes professionnels reconnus.</small></span></label>
      <div className="quality-list"><span>✓ Une seule réponse incontestable</span><span>✓ Aucune question ambiguë</span><span>✓ Explication après chaque réponse</span><span>✓ Sources consultables</span></div>
      {generating&&<div className="generation-progress"><span className="loader dark"/><div><b>{generationStatus}</b><small>Recherche → rédaction → contrôle qualité</small></div></div>}
      <div className="modal-actions"><button type="button" onClick={()=>setMode(null)}>Annuler</button><button className="primary" disabled={generating}>{generating?"Contrôle en cours…":<><Icon name="wand" size={16}/>Rechercher et générer</>}</button></div></form></>}
    {mode==="external"&&<><button className="back-link" onClick={()=>setMode("choice")}>← Retour</button><span className="modal-icon"><Icon name="plug"/></span><p className="eyebrow">INTÉGRER UNE RESSOURCE</p><h2>Ajouter une application</h2><p className="modal-intro">Utilisez le lien de partage fourni par Canva, Genially, YouTube ou votre autre application.</p><form onSubmit={externalCreate}><label>Application<select name="app">{apps.map(a=><option key={a.name}>{a.name}</option>)}</select></label><label>Titre de la ressource<input name="title" required placeholder="Ex. Présentation sur le cercle de Sinner"/></label><label>Lien de partage<input name="url" required type="url" placeholder="https://…"/></label><div className="security-note">🔒 Le contenu reste hébergé dans l’application d’origine.</div><div className="modal-actions"><button type="button" onClick={()=>setMode(null)}>Annuler</button><button className="primary">Ajouter à la bibliothèque →</button></div></form></>}
  </section></div>
}

function ImageInput(){
  return <label className="image-upload"><input type="file" name="image" accept="image/png,image/jpeg"/><span><Icon name="upload" size={20}/></span><div><b>Ajouter une image de présentation</b><small>PNG ou JPEG • 5 Mo maximum • optionnel</small></div><em>Choisir une image</em></label>
}

function Player({activity,step,selected,setSelected,finish,score,next,close,save,saved}:{activity:Activity;step:number;selected:number|null;setSelected:(n:number)=>void;finish:boolean;score:number;next:()=>void;close:()=>void;save:(e:FormEvent<HTMLFormElement>)=>void;saved:boolean}){
  const q=activity.questions[step]||sampleQuestions[0];
  const leave=()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});close()};
  const expand=()=>document.documentElement.requestFullscreen?.().catch(()=>{});
  return <div className="modal-backdrop play-bg" onMouseDown={leave}><section className="modal play-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><button className="modal-close" onClick={leave}>×</button>
    {!finish?<div className={`play-stage ${activity.coverImageUrl?"has-visual":""}`}><div className="play-head"><span className="question-tag mint">{activity.type}</span><div><span>{step+1} / {activity.questions.length}</span><button onClick={expand} title="Afficher en plein écran"><Icon name="expand" size={16}/>Plein écran</button></div></div><div className="progress"><i style={{width:`${(step+1)/activity.questions.length*100}%`}}/></div>{activity.coverImageUrl&&<img className="quiz-image" src={activity.coverImageUrl} alt={activity.imageAlt||`Illustration de ${activity.title}`}/>}<div className="question-zone">{q.objective&&<p className="question-objective">OBJECTIF : {q.objective}</p>}<h2>{q.question}</h2><div className="answers">{q.options.map((o,i)=><button className={selected===i?(i===q.correct?"correct":"wrong"):""} key={o} onClick={()=>setSelected(i)}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>{selected!==null&&<><div className={`feedback ${selected===q.correct?"good":"retry"}`}><strong>{selected===q.correct?"Bonne réponse !":"Pas tout à fait"}</strong><p>{q.explanation}</p></div>{q.sourceIndexes?.length?<div className="question-sources"><b>Sources :</b>{q.sourceIndexes.map(i=>activity.sources?.[i]).filter(Boolean).map((s,i)=><a key={s!.url} href={s!.url} target="_blank" rel="noreferrer">{i+1}. {s!.publisher||s!.title}</a>)}</div>:null}</>}<button className="next-btn" disabled={selected===null} onClick={next}>{step===activity.questions.length-1?"Voir mon résultat":"Question suivante"} →</button></div></div>:
    <div className="finish-screen"><div className="score-ring"><strong>{Math.round(score/activity.questions.length*100)}%</strong><span>{score}/{activity.questions.length} bonnes réponses</span></div><p className="eyebrow">ACTIVITÉ TERMINÉE</p><h2>Bravo, vous avez terminé !</h2><p>Renseignez votre nom pour transmettre le résultat au formateur.</p>{!saved?<form onSubmit={save}><label>Votre prénom et votre nom<input name="learnerName" required placeholder="Ex. Fatou Santogo" autoFocus/></label><button className="primary">Envoyer mon résultat →</button></form>:<div className="saved-result"><span>✓</span><strong>Résultat envoyé au formateur</strong><button onClick={close}>Terminer</button></div>}</div>}
  </section></div>
}
