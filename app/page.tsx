"use client";

import { FormEvent, useMemo, useState } from "react";

type Game = { id:number; title:string; type:string; theme:string; duration:string; questions:number; color:string };

const starterGames: Game[] = [
  { id:1, title:"Le chariot bien préparé", type:"Glisser-déposer", theme:"Propreté & hygiène", duration:"12 min", questions:8, color:"mint" },
  { id:2, title:"Chasse aux risques", type:"Image interactive", theme:"Sécurité au travail", duration:"15 min", questions:10, color:"coral" },
  { id:3, title:"Les raccourcis Word", type:"Quiz express", theme:"Compétences numériques", duration:"8 min", questions:12, color:"blue" },
  { id:4, title:"Parler avec un résident", type:"Mise en situation", theme:"Français professionnel", duration:"20 min", questions:6, color:"violet" },
];
const topics = [
  { name:"Propreté & hygiène", icon:"✦", count:18, color:"mint" },
  { name:"Sécurité au travail", icon:"△", count:12, color:"coral" },
  { name:"Compétences numériques", icon:"⌘", count:9, color:"blue" },
  { name:"Français professionnel", icon:"A", count:7, color:"violet" },
];

type IconName = "home"|"book"|"game"|"chart"|"plus"|"search"|"bell"|"dots"|"play"|"spark";
function Icon({ name, size=20 }:{ name:IconName; size?:number }) {
  const paths:Record<IconName,React.ReactNode> = {
    home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    book:<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z"/></>,
    game:<><path d="M8.5 6h7a6 6 0 0 1 5.8 7.5l-1.2 4.2a2.7 2.7 0 0 1-4.7 1l-1.1-1.4H9.7l-1.1 1.4a2.7 2.7 0 0 1-4.7-1l-1.2-4.2A6 6 0 0 1 8.5 6Z"/><path d="M7 11v4M5 13h4M16.5 12h.01M19 15h.01"/></>,
    chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    dots:<><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    play:<path d="m9 6 9 6-9 6Z" fill="currentColor"/>,
    spark:<><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Home() {
  const [games,setGames] = useState(starterGames);
  const [theme,setTheme] = useState("Toutes");
  const [query,setQuery] = useState("");
  const [creator,setCreator] = useState(false);
  const [playing,setPlaying] = useState<Game|null>(null);
  const [answer,setAnswer] = useState<number|null>(null);
  const filtered = useMemo(() => games.filter(g => (theme==="Toutes"||g.theme===theme) && g.title.toLowerCase().includes(query.toLowerCase())),[games,theme,query]);

  function createGame(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const newTheme = String(data.get("theme"));
    setGames(current => [{
      id:Date.now(), title:String(data.get("title")), type:String(data.get("type")), theme:newTheme,
      duration:`${data.get("duration")} min`, questions:Number(data.get("questions")),
      color:topics.find(t=>t.name===newTheme)?.color || "blue"
    },...current]);
    setCreator(false);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">P</span><span>Progressed<br/><b>Pédago</b></span></div>
      <nav aria-label="Navigation principale">
        <button className="nav-item active"><Icon name="home"/>Tableau de bord</button>
        <button className="nav-item"><Icon name="book"/>Mes formations</button>
        <button className="nav-item"><Icon name="game"/>Jeux pédagogiques<span className="nav-count">{games.length}</span></button>
        <button className="nav-item"><Icon name="chart"/>Résultats</button>
      </nav>
      <div className="side-card"><Icon name="spark" size={24}/><strong>Besoin d’une idée ?</strong><p>Transformez un objectif pédagogique en activité ludique.</p><button onClick={()=>setCreator(true)}>Créer avec l’assistant</button></div>
      <div className="profile"><span className="avatar">JM</span><div><strong>Jacky M.</strong><small>Formateur consultant</small></div><Icon name="dots"/></div>
    </aside>
    <main>
      <header className="topbar">
        <div><p className="eyebrow">DIMANCHE 23 AOÛT</p><h1>Bonjour Jacky, prêt à transmettre ?</h1></div>
        <div className="top-actions">
          <label className="search"><Icon name="search" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un jeu…"/></label>
          <button className="icon-button" aria-label="Notifications"><Icon name="bell"/></button>
          <button className="primary" onClick={()=>setCreator(true)}><Icon name="plus" size={18}/>Créer une activité</button>
        </div>
      </header>
      <section className="hero-panel">
        <div><span className="pill"><Icon name="spark" size={14}/>NOUVEAU PARCOURS</span><h2>Faites vivre vos formations.</h2><p>Centralisez vos ressources, créez des jeux pédagogiques et impliquez chaque apprenant — depuis un seul espace.</p><button onClick={()=>setCreator(true)}>Commencer à créer <span>→</span></button></div>
        <div className="hero-visual" aria-hidden="true"><div className="orbit one"/><div className="orbit two"/><div className="card-stack card-a"><span>QUIZ</span><b>?</b></div><div className="card-stack card-b"><span>CLASSER</span><b>↕</b></div><div className="card-stack card-c"><span>JOUER</span><b>▶</b></div></div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="kicker">VOS UNIVERS</span><h2>Enseigner par thématique</h2></div><button className="text-button">Gérer les thématiques →</button></div>
        <div className="topic-grid">{topics.map(t=><button key={t.name} onClick={()=>setTheme(theme===t.name?"Toutes":t.name)} className={`topic-card ${t.color} ${theme===t.name?"selected":""}`}><span className="topic-icon">{t.icon}</span><div><strong>{t.name}</strong><small>{t.count} ressources</small></div><span className="arrow">↗</span></button>)}</div>
      </section>
      <section className="section-block games-section">
        <div className="section-heading"><div><span className="kicker">BIBLIOTHÈQUE</span><h2>Jeux prêts à animer</h2></div><div className="filters"><button className={theme==="Toutes"?"active":""} onClick={()=>setTheme("Toutes")}>Tous</button><button onClick={()=>setCreator(true)}>+ Nouveau jeu</button></div></div>
        <div className="game-grid">
          {filtered.map(g=><article className="game-card" key={g.id}><div className={`game-cover ${g.color}`}><span className="game-type">{g.type}</span><div className="game-symbol"><Icon name={g.type.includes("Quiz")?"spark":"game"} size={34}/></div><button className="play-button" onClick={()=>{setPlaying(g);setAnswer(null)}} aria-label={`Jouer à ${g.title}`}><Icon name="play" size={18}/></button></div><div className="game-content"><span>{g.theme}</span><h3>{g.title}</h3><div><small>{g.duration}</small><small>{g.questions} étapes</small><button aria-label="Options"><Icon name="dots"/></button></div></div></article>)}
          {!filtered.length&&<div className="empty-state"><Icon name="search" size={30}/><strong>Aucun jeu trouvé</strong><p>Essayez un autre mot-clé ou affichez toutes les thématiques.</p></div>}
        </div>
      </section>
    </main>

    {creator&&<div className="modal-backdrop" onMouseDown={()=>setCreator(false)}><section className="modal" onMouseDown={e=>e.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="creator-title">
      <button className="modal-close" onClick={()=>setCreator(false)} aria-label="Fermer">×</button><span className="modal-icon"><Icon name="spark"/></span><p className="eyebrow">ATELIER DE CRÉATION</p><h2 id="creator-title">Créer un jeu pédagogique</h2><p className="modal-intro">Posez le cadre de l’activité. Vous pourrez ensuite enrichir les consignes et les questions.</p>
      <form onSubmit={createGame}><label>Titre de l’activité<input name="title" required placeholder="Ex. Le bon dosage des produits"/></label><div className="form-row"><label>Format<select name="type"><option>Quiz express</option><option>Glisser-déposer</option><option>Mise en situation</option><option>Image interactive</option><option>Vrai ou faux</option></select></label><label>Thématique<select name="theme">{topics.map(t=><option key={t.name}>{t.name}</option>)}</select></label></div><div className="form-row"><label>Durée (minutes)<input name="duration" type="number" min="3" max="60" defaultValue="10"/></label><label>Nombre d’étapes<input name="questions" type="number" min="1" max="30" defaultValue="8"/></label></div><div className="modal-actions"><button type="button" onClick={()=>setCreator(false)}>Annuler</button><button className="primary" type="submit">Créer le brouillon <span>→</span></button></div></form>
    </section></div>}

    {playing&&<div className="modal-backdrop" onMouseDown={()=>setPlaying(null)}><section className="modal play-modal" onMouseDown={e=>e.stopPropagation()} aria-modal="true" role="dialog">
      <button className="modal-close" onClick={()=>setPlaying(null)} aria-label="Fermer">×</button><span className={`question-tag ${playing.color}`}>{playing.theme}</span><p className="question-count">QUESTION 1 SUR {playing.questions}</p><h2>Quel est le premier réflexe à avoir avant de commencer l’activité ?</h2>
      <div className="answers">{["Présenter l’objectif et les règles","Distribuer immédiatement les réponses","Commencer sans consigne"].map((item,i)=><button className={answer===i?(i===0?"correct":"wrong"):""} key={item} onClick={()=>setAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{item}</button>)}</div>
      {answer!==null&&<div className={`feedback ${answer===0?"good":"retry"}`}><strong>{answer===0?"Bonne réponse !":"À revoir"}</strong><p>{answer===0?"Une consigne claire sécurise les apprenants et facilite leur engagement.":"Avant de jouer, le formateur donne le but, les règles et le temps disponible."}</p></div>}
    </section></div>}
  </div>;
}
