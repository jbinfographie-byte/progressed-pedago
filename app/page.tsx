"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Question={ question:string; options:string[]; correct:number; explanation:string };
type Activity={ id:number; title:string; type:string; theme:string; duration:number; questions:Question[]; color:string; source?:string; externalUrl?:string|null };
type Result={ id:number; learnerName:string; activityTitle:string; activityType:string; score:number; maxScore:number; durationSeconds:number; completedAt:string };
type View="home"|"activities"|"results"|"connections";

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

type IconName="home"|"book"|"game"|"chart"|"plus"|"search"|"bell"|"dots"|"play"|"spark"|"plug"|"download"|"users"|"wand";
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
    wand:<><path d="m15 4 5 5L8 21H3v-5Z"/><path d="m6 15 5 5M6 3v4M4 5h4M19 14v4M17 16h4"/></>
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
  const [toast,setToast]=useState("");

  useEffect(()=>{ Promise.all([
    fetch("/api/activities").then(r=>r.json()).catch(()=>({activities:[]})),
    fetch("/api/results").then(r=>r.json()).catch(()=>({results:[]}))
  ]).then(([a,r])=>{ if(a.activities?.length)setActivities([...a.activities.map((x:Activity,i:number)=>({...x,color:formats[i%formats.length].color})),...starters]); setResults(r.results||[]) }) },[]);

  const filtered=useMemo(()=>activities.filter(a=>a.title.toLowerCase().includes(query.toLowerCase())||a.theme.toLowerCase().includes(query.toLowerCase())),[activities,query]);
  const average=results.length?Math.round(results.reduce((n,r)=>n+(r.score/r.maxScore)*100,0)/results.length):0;
  const score=answers.reduce((n,a,i)=>n+(a===(playing?.questions[i]?.correct??-1)?1:0),0)+(selected===(playing?.questions[step]?.correct??-2)&&finish?1:0);

  function notify(text:string){setToast(text);setTimeout(()=>setToast(""),2600)}
  async function persistActivity(activity:Omit<Activity,"id"|"color">){
    const response=await fetch("/api/activities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(activity)});
    const data=await response.json();
    const created:Activity={...(data.activity||activity),id:data.activity?.id||Date.now(),color:formats.find(f=>f.name===activity.type)?.color||"mint"};
    setActivities(current=>[created,...current]);return created;
  }
  function start(activity:Activity){setPlaying(activity);setStep(0);setAnswers([]);setSelected(null);setFinish(false);setSaved(false)}
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
    e.preventDefault();const d=new FormData(e.currentTarget);const activity=await persistActivity({title:String(d.get("title")),type:String(d.get("type")),theme:String(d.get("theme")),duration:Number(d.get("duration")),questions:sampleQuestions,source:"manual"});setCreator(null);notify(`« ${activity.title} » ajouté à la bibliothèque`);
  }
  async function aiCreate(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const d=new FormData(e.currentTarget);setGenerating(true);
    const response=await fetch("/api/ai/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:d.get("prompt"),type:d.get("type"),count:d.get("count"),level:d.get("level")})});
    const data=await response.json();const activity=await persistActivity({...data.activity,source:"ai"});setGenerating(false);setCreator(null);notify(`Activité IA « ${activity.title} » créée`);
  }
  async function externalCreate(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const d=new FormData(e.currentTarget);await persistActivity({title:String(d.get("title")),type:"Ressource intégrée",theme:String(d.get("app")),duration:10,questions:sampleQuestions,source:"external",externalUrl:String(d.get("url"))});setCreator(null);notify("Ressource externe ajoutée");
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">P</span><span>Progressed<br/><b>Pédago</b></span></div>
      <nav aria-label="Navigation principale">
        <button onClick={()=>setView("home")} className={`nav-item ${view==="home"?"active":""}`}><Icon name="home"/>Tableau de bord</button>
        <button onClick={()=>setView("activities")} className={`nav-item ${view==="activities"?"active":""}`}><Icon name="game"/>Activités<span className="nav-count">{activities.length}</span></button>
        <button onClick={()=>setView("results")} className={`nav-item ${view==="results"?"active":""}`}><Icon name="chart"/>Résultats<span className="nav-count">{results.length}</span></button>
        <button onClick={()=>setView("connections")} className={`nav-item ${view==="connections"?"active":""}`}><Icon name="plug"/>Connexions</button>
      </nav>
      <div className="side-card"><Icon name="spark" size={24}/><strong>Assistant pédagogique IA</strong><p>Décrivez une idée : l’assistant prépare le jeu, les réponses et les corrections.</p><button onClick={()=>setCreator("ai")}>Créer avec l’IA</button></div>
      <div className="profile"><span className="avatar">JM</span><div><strong>Jacky M.</strong><small>Formateur consultant</small></div><Icon name="dots"/></div>
    </aside>
    <main>
      <header className="topbar"><div><p className="eyebrow">ESPACE FORMATEUR</p><h1>{view==="home"?"Bonjour Jacky, prêt à transmettre ?":view==="activities"?"Ma fabrique d’activités":view==="results"?"Résultats des apprenants":"Applications connectées"}</h1></div><div className="top-actions">{(view==="home"||view==="activities")&&<label className="search"><Icon name="search" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher…"/></label>}<button className="icon-button" aria-label="Notifications"><Icon name="bell"/></button><button className="primary" onClick={()=>setCreator("choice")}><Icon name="plus" size={18}/>Créer une activité</button></div></header>

      {view==="home"&&<>
        <section className="hero-panel ai-hero"><div><span className="pill"><Icon name="wand" size={14}/>CRÉATION ASSISTÉE PAR CHATGPT</span><h2>Une idée devient un jeu.</h2><p>Écrivez votre objectif en quelques mots. L’assistant construit les questions, les réponses, les consignes et les explications.</p><button onClick={()=>setCreator("ai")}>Essayer l’atelier IA <span>→</span></button></div><div className="prompt-preview"><span>Votre demande</span><p>« Crée un glisser-déposer sur la préparation d’un chariot de nettoyage… »</p><div><i/><i/><i/><b>Activité prête ✓</b></div></div></section>
        <section className="quick-stats"><article><span className="stat-icon green"><Icon name="game"/></span><div><strong>{activities.length}</strong><small>activités disponibles</small></div></article><article><span className="stat-icon purple"><Icon name="users"/></span><div><strong>{results.length}</strong><small>participations reçues</small></div></article><article><span className="stat-icon yellow"><Icon name="chart"/></span><div><strong>{average}%</strong><small>réussite moyenne</small></div></article><article><span className="stat-icon pink"><Icon name="plug"/></span><div><strong>{apps.length}</strong><small>applications intégrables</small></div></article></section>
        <section className="section-block"><div className="section-heading"><div><span className="kicker">CHOISIR UN FORMAT</span><h2>Des activités pour chaque moment</h2></div><button className="text-button" onClick={()=>setView("activities")}>Voir tous les formats →</button></div><div className="format-strip">{formats.slice(0,4).map(f=><button key={f.name} onClick={()=>setCreator("manual")} className={`format-card ${f.color}`}><span>{f.icon}</span><strong>{f.name}</strong><small>{f.text}</small><b>Créer →</b></button>)}</div></section>
        <ActivityLibrary activities={filtered.slice(0,4)} start={start} onCreate={()=>setCreator("choice")}/>
      </>}

      {view==="activities"&&<>
        <section className="studio-banner"><div><span className="pill"><Icon name="spark" size={14}/>FABRIQUE LUDIQUE</span><h2>Comment voulez-vous commencer ?</h2><p>Partez d’un modèle, décrivez votre idée à l’IA ou intégrez une ressource existante.</p></div><div className="studio-actions"><button onClick={()=>setCreator("ai")}><Icon name="wand"/><strong>Générer avec l’IA</strong><small>À partir d’un prompt</small></button><button onClick={()=>setCreator("manual")}><Icon name="plus"/><strong>Créer manuellement</strong><small>À partir d’un format</small></button><button onClick={()=>setCreator("external")}><Icon name="plug"/><strong>Importer un contenu</strong><small>Canva, Genially, lien…</small></button></div></section>
        <section className="section-block"><div className="section-heading"><div><span className="kicker">8 FORMATS LUDIQUES</span><h2>Choisir une mécanique de jeu</h2></div></div><div className="all-formats">{formats.map(f=><button key={f.name} onClick={()=>setCreator("manual")} className={`format-tile ${f.color}`}><span>{f.icon}</span><div><strong>{f.name}</strong><small>{f.text}</small></div><b>→</b></button>)}</div></section>
        <ActivityLibrary activities={filtered} start={start} onCreate={()=>setCreator("choice")}/>
      </>}

      {view==="results"&&<section className="results-page">
        <div className="results-toolbar"><div><span className="kicker">SUIVI PÉDAGOGIQUE</span><h2>Vue d’ensemble</h2><p>Chaque apprenant renseigne son nom à la fin de l’activité. Son résultat apparaît ici.</p></div><div><button onClick={exportCsv}><Icon name="download" size={17}/>Exporter pour Excel</button><button onClick={()=>window.print()}><Icon name="download" size={17}/>Exporter en PDF</button></div></div>
        <div className="result-cards"><article><small>Participations</small><strong>{results.length}</strong><span>résultats enregistrés</span></article><article><small>Réussite moyenne</small><strong>{average}%</strong><div className="meter"><i style={{width:`${average}%`}}/></div></article><article><small>Apprenants actifs</small><strong>{new Set(results.map(r=>r.learnerName)).size}</strong><span>noms différents</span></article></div>
        <div className="result-table-wrap"><div className="table-title"><h3>Derniers résultats</h3><span>{results.length} participation{results.length>1?"s":""}</span></div><table><thead><tr><th>Apprenant</th><th>Activité</th><th>Format</th><th>Score</th><th>Réussite</th><th>Date</th></tr></thead><tbody>{results.map(r=><tr key={r.id}><td><span className="mini-avatar">{r.learnerName.slice(0,2).toUpperCase()}</span><b>{r.learnerName}</b></td><td>{r.activityTitle}</td><td><span className="type-badge">{r.activityType}</span></td><td>{r.score}/{r.maxScore}</td><td><b className={r.score/r.maxScore>=.7?"success":"warning"}>{Math.round(r.score/r.maxScore*100)}%</b></td><td>{new Date(r.completedAt).toLocaleDateString("fr-FR")}</td></tr>)}{!results.length&&<tr><td colSpan={6}><div className="no-results"><Icon name="users" size={30}/><strong>Aucun résultat pour le moment</strong><span>Lancez une activité test pour découvrir le suivi.</span></div></td></tr>}</tbody></table></div>
      </section>}

      {view==="connections"&&<section className="connections-page"><div className="connection-intro"><div><span className="pill"><Icon name="plug" size={14}/>CENTRE DE CONNEXIONS</span><h2>Réunissez tous vos outils pédagogiques.</h2><p>Ajoutez vos contenus existants dans Progressed Pédago. L’apprenant retrouve tout dans un même parcours.</p></div><button onClick={()=>setCreator("external")}><Icon name="plus"/>Ajouter une ressource</button></div><div className="apps-grid">{apps.map(app=><article key={app.name}><span style={{background:app.color}}>{app.mark}</span><div><h3>{app.name}</h3><p>{app.text}</p></div><button onClick={()=>setCreator("external")}>Connecter</button></article>)}</div><div className="embed-tip"><Icon name="spark"/><div><strong>Une application n’est pas dans la liste ?</strong><p>Copiez son lien de partage ou son code d’intégration. Progressed Pédago peut la présenter dans votre bibliothèque.</p></div><button onClick={()=>setCreator("external")}>Ajouter par lien →</button></div></section>}
    </main>

    {creator&&<Creator mode={creator} setMode={setCreator} manualCreate={manualCreate} aiCreate={aiCreate} externalCreate={externalCreate} generating={generating}/>}
    {playing&&<Player activity={playing} step={step} selected={selected} setSelected={setSelected} finish={finish} score={score} next={nextQuestion} close={()=>setPlaying(null)} save={saveResult} saved={saved}/>}
    {toast&&<div className="toast"><span>✓</span>{toast}</div>}
  </div>
}

function ActivityLibrary({activities,start,onCreate}:{activities:Activity[];start:(a:Activity)=>void;onCreate:()=>void}){
  return <section className="section-block games-section"><div className="section-heading"><div><span className="kicker">VOTRE BIBLIOTHÈQUE</span><h2>Activités prêtes à animer</h2></div><button className="text-button" onClick={onCreate}>+ Nouvelle activité</button></div><div className="game-grid">{activities.map(a=><article className="game-card" key={`${a.id}-${a.title}`}><div className={`game-cover ${a.color}`}><span className="game-type">{a.source==="ai"?"✦ Créé avec l’IA":a.type}</span><div className="game-symbol">{formats.find(f=>f.name===a.type)?.icon||"▶"}</div><button className="play-button" onClick={()=>start(a)} aria-label={`Jouer à ${a.title}`}><Icon name="play" size={18}/></button></div><div className="game-content"><span>{a.theme}</span><h3>{a.title}</h3><div><small>{a.duration} min</small><small>{a.questions.length} étapes</small><button aria-label="Options"><Icon name="dots"/></button></div></div></article>)}</div></section>
}

function Creator({mode,setMode,manualCreate,aiCreate,externalCreate,generating}:{mode:string;setMode:(m:"choice"|"manual"|"ai"|"external"|null)=>void;manualCreate:(e:FormEvent<HTMLFormElement>)=>void;aiCreate:(e:FormEvent<HTMLFormElement>)=>void;externalCreate:(e:FormEvent<HTMLFormElement>)=>void;generating:boolean}){
  return <div className="modal-backdrop" onMouseDown={()=>setMode(null)}><section className="modal creator-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><button className="modal-close" onClick={()=>setMode(null)}>×</button>
    {mode==="choice"&&<><span className="modal-icon"><Icon name="plus"/></span><p className="eyebrow">NOUVELLE ACTIVITÉ</p><h2>Comment souhaitez-vous créer ?</h2><p className="modal-intro">Choisissez le point de départ le plus simple pour vous.</p><div className="creation-choices"><button onClick={()=>setMode("ai")}><span><Icon name="wand"/></span><div><strong>Créer avec ChatGPT</strong><small>Décrivez le résultat attendu en langage simple</small></div><b>→</b></button><button onClick={()=>setMode("manual")}><span><Icon name="game"/></span><div><strong>Construire manuellement</strong><small>Choisissez un format puis personnalisez-le</small></div><b>→</b></button><button onClick={()=>setMode("external")}><span><Icon name="plug"/></span><div><strong>Intégrer une application</strong><small>Canva, Genially, YouTube ou autre lien</small></div><b>→</b></button></div></>}
    {mode==="manual"&&<><button className="back-link" onClick={()=>setMode("choice")}>← Retour</button><span className="modal-icon"><Icon name="game"/></span><p className="eyebrow">CRÉATION MANUELLE</p><h2>Préparer une activité</h2><form onSubmit={manualCreate}><label>Titre<input name="title" required placeholder="Ex. Classer les EPI selon le risque"/></label><div className="form-row"><label>Format<select name="type">{formats.map(f=><option key={f.name}>{f.name}</option>)}</select></label><label>Thématique<select name="theme"><option>Propreté & hygiène</option><option>Sécurité au travail</option><option>Compétences numériques</option><option>Français professionnel</option></select></label></div><label>Durée estimée<input name="duration" type="number" min="3" max="60" defaultValue="10"/></label><div className="modal-actions"><button type="button" onClick={()=>setMode(null)}>Annuler</button><button className="primary">Créer le brouillon →</button></div></form></>}
    {mode==="ai"&&<><button className="back-link" onClick={()=>setMode("choice")}>← Retour</button><span className="modal-icon ai"><Icon name="wand"/></span><p className="eyebrow">ASSISTANT PÉDAGOGIQUE CHATGPT</p><h2>Décrivez votre activité.</h2><p className="modal-intro">Expliquez le thème, le public et ce que l’apprenant doit retenir. L’IA construit une première version modifiable.</p><form onSubmit={aiCreate}><label>Votre prompt<textarea name="prompt" required placeholder="Ex. Crée un glisser-déposer simple pour des agents débutants. Ils doivent remettre dans l’ordre les étapes de préparation d’un chariot de nettoyage en EHPAD."/></label><div className="prompt-chips"><button type="button">+ Ajouter un objectif</button><button type="button">+ Préciser le public</button><button type="button">+ Demander des explications</button></div><div className="form-row"><label>Format<select name="type">{formats.slice(0,6).map(f=><option key={f.name}>{f.name}</option>)}</select></label><label>Niveau<select name="level"><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option></select></label></div><label>Nombre d’étapes<input name="count" type="range" min="3" max="10" defaultValue="5"/></label><div className="ai-note"><Icon name="spark" size={17}/><span>L’activité générée pourra être relue et adaptée avant son partage.</span></div><div className="modal-actions"><button type="button" onClick={()=>setMode(null)}>Annuler</button><button className="primary" disabled={generating}>{generating?<><span className="loader"/>Création en cours…</>:<><Icon name="wand" size={16}/>Générer l’activité</>}</button></div></form></>}
    {mode==="external"&&<><button className="back-link" onClick={()=>setMode("choice")}>← Retour</button><span className="modal-icon"><Icon name="plug"/></span><p className="eyebrow">INTÉGRER UNE RESSOURCE</p><h2>Ajouter une application</h2><p className="modal-intro">Utilisez le lien de partage fourni par Canva, Genially, YouTube ou votre autre application.</p><form onSubmit={externalCreate}><label>Application<select name="app">{apps.map(a=><option key={a.name}>{a.name}</option>)}</select></label><label>Titre de la ressource<input name="title" required placeholder="Ex. Présentation sur le cercle de Sinner"/></label><label>Lien de partage<input name="url" required type="url" placeholder="https://…"/></label><div className="security-note">🔒 Le contenu reste hébergé dans l’application d’origine.</div><div className="modal-actions"><button type="button" onClick={()=>setMode(null)}>Annuler</button><button className="primary">Ajouter à la bibliothèque →</button></div></form></>}
  </section></div>
}

function Player({activity,step,selected,setSelected,finish,score,next,close,save,saved}:{activity:Activity;step:number;selected:number|null;setSelected:(n:number)=>void;finish:boolean;score:number;next:()=>void;close:()=>void;save:(e:FormEvent<HTMLFormElement>)=>void;saved:boolean}){
  const q=activity.questions[step]||sampleQuestions[0];return <div className="modal-backdrop play-bg" onMouseDown={close}><section className="modal play-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><button className="modal-close" onClick={close}>×</button>
    {!finish?<><div className="play-head"><span className="question-tag mint">{activity.type}</span><span>{step+1} / {activity.questions.length}</span></div><div className="progress"><i style={{width:`${(step+1)/activity.questions.length*100}%`}}/></div><h2>{q.question}</h2><div className="answers">{q.options.map((o,i)=><button className={selected===i?(i===q.correct?"correct":"wrong"):""} key={o} onClick={()=>setSelected(i)}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>{selected!==null&&<div className={`feedback ${selected===q.correct?"good":"retry"}`}><strong>{selected===q.correct?"Bonne réponse !":"Pas tout à fait"}</strong><p>{q.explanation}</p></div>}<button className="next-btn" disabled={selected===null} onClick={next}>{step===activity.questions.length-1?"Voir mon résultat":"Question suivante"} →</button></>:
    <div className="finish-screen"><div className="score-ring"><strong>{Math.round(score/activity.questions.length*100)}%</strong><span>{score}/{activity.questions.length} bonnes réponses</span></div><p className="eyebrow">ACTIVITÉ TERMINÉE</p><h2>Bravo, vous avez terminé !</h2><p>Renseignez votre nom pour transmettre le résultat au formateur.</p>{!saved?<form onSubmit={save}><label>Votre prénom et votre nom<input name="learnerName" required placeholder="Ex. Fatou Santogo" autoFocus/></label><button className="primary">Envoyer mon résultat →</button></form>:<div className="saved-result"><span>✓</span><strong>Résultat envoyé au formateur</strong><button onClick={close}>Terminer</button></div>}</div>}
  </section></div>
}
