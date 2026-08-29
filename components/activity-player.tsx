'use client';

import { useState } from 'react';
import { ACTIVITY_TYPES, normalizeAnswer, type ActivityType } from '@/lib/activity-types';
import { ActivityPrintSheet, StructuredExplanation, type PrintableActivity } from '@/components/activity-print-sheet';
import { normalizeScenarioContent, type ScenarioChoice, type ScenarioCitation } from '@/lib/scenario';

type PlayerActivity = PrintableActivity & { id?: string };
type Item = { id?: string; label?: string; text?: string; answer?: string; category?: string; correct?: boolean; front?: string; back?: string; pair?: string };
type SourceMedia = { kind: 'youtube' | 'vimeo'; url: string; embedUrl: string; title: string; videoId: string } | { kind: 'direct'; url: string; title: string; mimeType: string };

const asItems = (value: unknown): Item[] => Array.isArray(value) ? value.filter((item): item is Item => Boolean(item && typeof item === 'object')) : [];
const label = (item: Item) => String(item.label ?? item.text ?? item.front ?? 'Élément');

export function ActivityPlayer({ activity, onClose, journey }: { activity: PlayerActivity; onClose: () => void; journey?: {name:string;index:number;total:number;onPrevious?:()=>void;onNext?:()=>void} }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [lessonOpen,setLessonOpen] = useState(activity.type !== 'scenario');
  const sourceMedia = readSourceMedia(activity.content.sourceMedia);
  return (
    <div className={`player-backdrop ${fullscreen ? 'is-fullscreen' : ''}`} role="dialog" aria-modal="true" aria-labelledby="player-title">
      <section className="player-shell">
        <div className="screen-player-content">
          <header className="player-header">
            <div><p className="overline">{journey ? `${journey.name} · étape ${journey.index + 1} sur ${journey.total}` : 'Activité en direct'}</p><h2 id="player-title">{activity.title}</h2><p>{activity.instructions}</p></div>
            <div>{activity.explanation && <button className="button light" type="button" aria-expanded={lessonOpen} onClick={() => setLessonOpen((value) => !value)}>{lessonOpen ? 'Masquer le cours' : 'Voir le cours'}</button>}<button className="button light" type="button" onClick={() => window.print()}>Imprimer le support A4</button><button className="button light" type="button" onClick={() => setFullscreen((value) => !value)}>{fullscreen ? 'Réduire' : 'Plein écran'}</button>{journey?.onPrevious && <button className="button light" type="button" onClick={journey.onPrevious}>← Étape précédente</button>}{journey?.onNext && <button className="button dark" type="button" onClick={journey.onNext}>Étape suivante →</button>}<button className={journey?.onNext ? 'button light' : 'button dark'} type="button" onClick={onClose}>{journey ? 'Quitter le parcours' : 'Fermer'}</button></div>
          </header>
          <div className="activity-context"><span>{ACTIVITY_TYPES.find(([type]) => type === activity.type)?.[1] ?? activity.type}</span><p><strong>Objectif de l’activité</strong>{activity.objectives?.[0] ?? 'Comprendre, pratiquer puis expliquer la réponse.'}</p><p><strong>Durée indicative</strong>{activity.durationMinutes ? `${activity.durationMinutes} minutes` : 'À adapter au groupe'}</p></div>
          {sourceMedia && <section className="source-video"><div><span>Vidéo source analysée</span><strong>{sourceMedia.title}</strong><a href={sourceMedia.url} target="_blank" rel="noreferrer">Ouvrir la source ↗</a></div>{sourceMedia.kind === 'direct' ? <video src={sourceMedia.url} controls preload="metadata" /> : <iframe src={sourceMedia.embedUrl} title={sourceMedia.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}</section>}
          {activity.explanation && <details className="lesson-drawer lesson-panel" open={lessonOpen} onToggle={(event) => setLessonOpen(event.currentTarget.open)}><summary><span>Mini-cours</span><strong>Comprendre avant de commencer</strong><small>Afficher ou masquer les explications détaillées</small></summary><StructuredExplanation text={activity.explanation} /></details>}
          <main className="mechanic-stage"><Mechanic type={activity.type} content={activity.content} activity={activity} /></main>
        </div>
        <ActivityPrintSheet activity={activity} />
      </section>
    </div>
  );
}

function readSourceMedia(value: unknown): SourceMedia | null {
  if (!value || typeof value !== 'object') return null; const media = value as Record<string,unknown>;
  if (media.kind === 'youtube' && typeof media.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(media.videoId)) return {kind:'youtube',videoId:media.videoId,url:`https://www.youtube.com/watch?v=${media.videoId}`,embedUrl:`https://www.youtube-nocookie.com/embed/${media.videoId}`,title:String(media.title ?? 'Vidéo YouTube')};
  if (media.kind === 'vimeo' && typeof media.videoId === 'string' && /^\d{5,12}$/.test(media.videoId)) return {kind:'vimeo',videoId:media.videoId,url:`https://vimeo.com/${media.videoId}`,embedUrl:`https://player.vimeo.com/video/${media.videoId}`,title:String(media.title ?? 'Vidéo Vimeo')};
  if (media.kind === 'direct' && typeof media.url === 'string') { try { const url = new URL(media.url); const mimeType = String(media.mimeType ?? 'video/mp4'); if (url.protocol === 'https:' && !url.username && !url.password && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) return {kind:'direct',url:url.toString(),title:String(media.title ?? 'Média en ligne'),mimeType}; } catch { return null; } }
  return null;
}

function Mechanic({ type, content,activity }: { type: ActivityType; content: Record<string, unknown>; activity: PlayerActivity }) {
  if (type === 'quiz' || type === 'tv-quiz') return <Quiz content={content} televised={type === 'tv-quiz'} />;
  if (type === 'true-false') return <TrueFalse content={content} />;
  if (['flip-tiles','revision-cards','memory-cards','random-cards','pair-or-not'].includes(type)) return <Cards content={content} random={type === 'random-cards'} memory={type === 'memory-cards'} pair={type === 'pair-or-not'} />;
  if (type === 'challenge-wheel' || type === 'question-wheel') return <Wheel content={content} questionMode={type === 'question-wheel'} />;
  if (type === 'word-search') return <WordSearch content={content} />;
  if (type === 'crossword') return <Crossword content={content} />;
  if (type === 'hangman') return <Hangman content={content} />;
  if (['spell-word','ranking','unravel','anagram'].includes(type)) return <Ordering content={content} letters={type === 'spell-word' || type === 'anagram'} />;
  if (['drag-drop','matching','categories','labelled-diagram'].includes(type)) return <Classifier content={content} />;
  if (type === 'type-answer') return <TypedAnswer content={content} />;
  if (type === 'maze') return <Maze content={content} />;
  if (type === 'scenario') return <Scenario content={content} activity={activity} />;
  if (type === 'live-poll') return <Poll content={content} />;
  if (type === 'interactive-image') return <InteractiveImage content={content} />;
  if (type === 'flying-fruits') return <FlyingFruits content={content} />;
  return <Classifier content={content} />;
}

function Quiz({ content, televised = false }: { content: Record<string, unknown>; televised?: boolean }) {
  const questions = (Array.isArray(content.questions) ? content.questions : []) as Array<{ question?: string; choices?: string[]; correctIndex?: number; explanation?: string }>;
  const [index, setIndex] = useState(0); const [answer, setAnswer] = useState<number | null>(null); const [score, setScore] = useState(0); const question = questions[index];
  if (!question) return <EmptyMechanic />;
  const select = (choice: number) => { if (answer !== null) return; setAnswer(choice); if (choice === Number(question.correctIndex ?? 0)) setScore((value) => value + 1); };
  return <div className={televised ? 'tv-board' : 'quiz-board'}>
    {televised && <div className="game-strip"><span>♥ ♥ ♥</span><strong>Score {score}</strong><span>{index + 1}/{questions.length}</span></div>}
    <p className="step-label">Question {index + 1} sur {questions.length}</p><h3>{question.question}</h3>
    <div className="choice-grid">{(question.choices ?? []).map((choice, choiceIndex) => <button type="button" key={choice} onClick={() => select(choiceIndex)} className={answer === null ? '' : choiceIndex === Number(question.correctIndex ?? 0) ? 'correct' : answer === choiceIndex ? 'wrong' : ''}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice}</button>)}</div>
    {answer !== null && <div className="feedback-box detailed-feedback" role="status"><span className="feedback-label">Correction expliquée</span><strong>{answer === Number(question.correctIndex ?? 0) ? 'Bonne réponse !' : 'À revoir'}</strong>{question.explanation ? <StructuredExplanation text={question.explanation} compact /> : <p>Relisez le mini-cours puis reformulez la règle avec vos propres mots.</p>}<button className="button dark" type="button" onClick={() => { setIndex((value) => (value + 1) % questions.length); setAnswer(null); }}>Question suivante</button></div>}
  </div>;
}

function TrueFalse({ content }: { content: Record<string, unknown> }) {
  const statements = (Array.isArray(content.statements) ? content.statements : []) as Array<{ text?: string; answer?: boolean; explanation?: string }>;
  const [index, setIndex] = useState(0); const [choice, setChoice] = useState<boolean | null>(null); const item = statements[index]; if (!item) return <EmptyMechanic />;
  return <div className="binary-board"><p className="step-label">Affirmation {index + 1}/{statements.length}</p><h3>{item.text}</h3><div><button type="button" onClick={() => setChoice(true)}>✓ Vrai</button><button type="button" onClick={() => setChoice(false)}>× Faux</button></div>{choice !== null && <div className="feedback-box detailed-feedback"><span className="feedback-label">Pourquoi ?</span><strong>{choice === Boolean(item.answer) ? 'Exact' : 'Pas tout à fait'}</strong>{item.explanation ? <StructuredExplanation text={item.explanation} compact /> : <p>Expliquez la règle qui permet de décider.</p>}<button className="button dark" type="button" onClick={() => { setIndex((value) => (value + 1) % statements.length); setChoice(null); }}>Continuer</button></div>}</div>;
}

function Cards({ content, random, memory, pair }: { content: Record<string, unknown>; random?: boolean; memory?: boolean; pair?: boolean }) {
  const cards = asItems(content.cards); const [index, setIndex] = useState(0); const [flipped, setFlipped] = useState(false); const [mastered, setMastered] = useState<string[]>([]); if (!cards.length) return <EmptyMechanic />;
  const visible = pair ? cards.slice(index, index + 2) : [cards[index]];
  const next = () => { setIndex(random ? Math.floor(Math.random() * cards.length) : (index + (pair ? 2 : 1)) % cards.length); setFlipped(false); };
  return <div className="cards-board"><div className={pair ? 'pair-grid' : 'single-card'}>{visible.map((card, cardIndex) => <button className={`flip-card ${flipped ? 'flipped' : ''}`} type="button" onClick={() => setFlipped((value) => !value)} key={`${index}-${cardIndex}`}><span>{flipped ? String(card.back ?? card.answer ?? 'Réponse') : String(card.front ?? card.label ?? 'Question')}</span><small>{flipped ? 'Verso' : 'Recto — toucher pour retourner'}</small></button>)}</div>{pair && flipped && <p className="feedback-box"><strong>{visible[0]?.pair && visible[0]?.pair === visible[1]?.pair ? 'C’est une paire !' : 'Ces cartes ne forment pas une paire.'}</strong></p>}{memory && <div className="self-actions"><button type="button" onClick={() => setMastered([...mastered, String(index)])}>À revoir</button><button type="button" onClick={() => { setMastered([...mastered, String(index)]); next(); }}>Acquis ✓</button></div>}<button className="button dark" type="button" onClick={next}>{random ? 'Tirer une carte' : 'Carte suivante'}</button></div>;
}

function Wheel({ content, questionMode = false }: { content: Record<string, unknown>; questionMode?: boolean }) {
  const sectors = asItems(content.sectors); const [rotation, setRotation] = useState(0); const [selected, setSelected] = useState<Item | null>(null); const [outcome,setOutcome] = useState(''); if (sectors.length < 2) return <EmptyMechanic />;
  const spin = () => { const target = Math.floor(Math.random() * sectors.length); setRotation((value) => value + 1080 + target * (360 / sectors.length)); window.setTimeout(() => setSelected(sectors[target]), 900); };
  return <div className="wheel-board"><div className="wheel-wrap"><span className="wheel-pointer">▼</span><div className="wheel" style={{ transform: `rotate(${rotation}deg)`, background: `conic-gradient(${sectors.map((_, index) => `${['#dff44c','#bde4dc','#f7d2c4','#d5e5f7'][index % 4]} ${index * 100 / sectors.length}% ${(index + 1) * 100 / sectors.length}%`).join(',')})` }}>{sectors.map((sector, index) => <span key={index} style={{ transform: `rotate(${(index + .5) * 360 / sectors.length}deg) translateY(-42%)` }}>{index + 1}</span>)}</div></div><button className="button dark" type="button" onClick={() => { setOutcome(''); spin(); }}>Faire tourner la roue</button>{selected && <div className="feedback-box"><strong>{questionMode ? 'Question sélectionnée' : 'Défi sélectionné'}</strong><p>{label(selected)}</p><div className="self-actions"><button type="button" onClick={() => setOutcome('À retravailler')}>À retravailler</button><button type="button" onClick={() => setOutcome('Réussi ✓')}>Réussi ✓</button></div>{outcome && <p role="status"><strong>{outcome}</strong></p>}</div>}</div>;
}

function WordSearch({ content }: { content: Record<string, unknown> }) {
  const grid = (Array.isArray(content.grid) ? content.grid : []) as Array<string[] | string>; const words = (Array.isArray(content.words) ? content.words : []).map(String); const [selected, setSelected] = useState<Array<[number,number]>>([]); const [found, setFound] = useState<string[]>([]);
  const letters = grid.map((row) => Array.isArray(row) ? row : String(row).split('')); const choose = (row: number, column: number) => setSelected((value) => value.some(([r,c]) => r === row && c === column) ? value.filter(([r,c]) => r !== row || c !== column) : [...value, [row,column]]);
  const validate = () => { const candidate = selected.map(([r,c]) => letters[r]?.[c] ?? '').join('').toUpperCase(); const match = words.find((word) => normalizeAnswer(word).replaceAll(' ','').toUpperCase() === candidate || normalizeAnswer(word).replaceAll(' ','').toUpperCase() === [...candidate].reverse().join('')); if (match && !found.includes(match)) setFound([...found, match]); setSelected([]); };
  if (!letters.length) return <EmptyMechanic />; return <div className="word-board"><div className="letter-grid" style={{ gridTemplateColumns: `repeat(${letters[0]?.length ?? 1}, 1fr)` }}>{letters.flatMap((row, rowIndex) => row.map((letterValue, columnIndex) => <button type="button" className={selected.some(([r,c]) => r === rowIndex && c === columnIndex) ? 'selected' : ''} onClick={() => choose(rowIndex,columnIndex)} key={`${rowIndex}-${columnIndex}`}>{letterValue}</button>))}</div><aside><h3>Mots à trouver</h3>{words.map((word) => <span className={found.includes(word) ? 'found' : ''} key={word}>{word}</span>)}<button className="button dark" type="button" onClick={validate}>Valider la sélection</button></aside></div>;
}

function Crossword({ content }: { content: Record<string, unknown> }) {
  const grid = (Array.isArray(content.grid) ? content.grid : []) as Array<string[] | string>; const clues = asItems(content.clues); if (!grid.length) return <EmptyMechanic />;
  return <div className="crossword-board"><div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${Array.isArray(grid[0]) ? grid[0].length : String(grid[0]).length}, 38px)` }}>{grid.flatMap((row, rowIndex) => (Array.isArray(row) ? row : String(row).split('')).map((cell, columnIndex) => cell === '#' ? <span className="blocked" key={`${rowIndex}-${columnIndex}`} /> : <input key={`${rowIndex}-${columnIndex}`} maxLength={1} aria-label={`Case ligne ${rowIndex + 1}, colonne ${columnIndex + 1}`} />))}</div><ol>{clues.map((clue, index) => <li key={index}>{label(clue)}</li>)}</ol></div>;
}

function Hangman({ content }: { content: Record<string, unknown> }) {
  const words = (Array.isArray(content.words) ? content.words : []).map(String); const word = normalizeAnswer(words[0] ?? '').replace(/[^a-z]/g, '').toUpperCase(); const [letters, setLetters] = useState<string[]>([]); const errors = letters.filter((letterValue) => !word.includes(letterValue)).length; if (!word) return <EmptyMechanic />;
  return <div className="hangman-board"><div className="hangman-figure" aria-label={`${errors} erreurs sur 7`}><strong>{errors}/7</strong><span>{errors > 0 ? '◯' : ''}</span><span>{errors > 1 ? '╱│╲' : ''}</span><span>{errors > 4 ? '╱ ╲' : ''}</span></div><div><div className="hidden-word">{[...word].map((letterValue,index) => <span key={index}>{letters.includes(letterValue) ? letterValue : '_'}</span>)}</div><div className="keyboard">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letterValue) => <button type="button" disabled={letters.includes(letterValue) || errors >= 7} onClick={() => setLetters([...letters,letterValue])} key={letterValue}>{letterValue}</button>)}</div></div></div>;
}

function Ordering({ content, letters }: { content: Record<string, unknown>; letters?: boolean }) {
  const source = asItems(content.items); const initial = source.length ? source : String(content.word ?? content.sentence ?? '').split(letters ? '' : ' ').map((value) => ({ label: value })); const [items, setItems] = useState(() => [...initial].sort(() => .5 - Math.random()));
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= items.length) return; const copy = [...items]; [copy[index],copy[target]] = [copy[target],copy[index]]; setItems(copy); };
  return <div className="ordering-board"><p>Sélectionnez les flèches pour remettre {letters ? 'les lettres' : 'les éléments'} dans l’ordre.</p><ol>{items.map((item,index) => <li key={`${label(item)}-${index}`}><strong>{label(item)}</strong><span><button type="button" onClick={() => move(index,-1)} aria-label={`Monter ${label(item)}`}>↑</button><button type="button" onClick={() => move(index,1)} aria-label={`Descendre ${label(item)}`}>↓</button></span></li>)}</ol></div>;
}

function Classifier({ content }: { content: Record<string, unknown> }) {
  const items = asItems(content.items); const categories = asItems(content.categories ?? content.zones); const [selected, setSelected] = useState<Item | null>(null); const [placements, setPlacements] = useState<Record<string,string[]>>({}); if (!items.length || !categories.length) return <EmptyMechanic />;
  const place = (category: Item) => { if (!selected) return; const key = label(category); setPlacements({ ...placements, [key]: [...(placements[key] ?? []), label(selected)] }); setSelected(null); };
  return <div className="classifier-board"><div><h3>Éléments</h3>{items.filter((item) => !Object.values(placements).flat().includes(label(item))).map((item,index) => <button type="button" className={selected === item ? 'selected' : ''} onClick={() => setSelected(item)} key={index}>{label(item)}</button>)}</div><div className="drop-zones">{categories.map((category,index) => <button type="button" onClick={() => place(category)} key={index}><strong>{label(category)}</strong><span>{(placements[label(category)] ?? []).join(' · ') || 'Déposer ici'}</span></button>)}</div></div>;
}

function TypedAnswer({ content }: { content: Record<string, unknown> }) {
  const prompts = (Array.isArray(content.prompts) ? content.prompts : []) as Array<{ question?: string; answer?: string; explanation?: string }>; const [index,setIndex] = useState(0); const [value,setValue] = useState(''); const [checked,setChecked] = useState(false); const item = prompts[index]; if (!item) return <EmptyMechanic />; const correct = normalizeAnswer(value) === normalizeAnswer(String(item.answer ?? ''));
  return <div className="typed-board"><h3>{item.question}</h3><label>Votre réponse<input value={value} onChange={(event) => { setValue(event.target.value); setChecked(false); }} /></label><button className="button dark" type="button" onClick={() => setChecked(true)}>Vérifier</button>{checked && <div className="feedback-box detailed-feedback"><span className="feedback-label">Correction expliquée</span><strong>{correct ? 'Bonne réponse' : `Réponse attendue : ${item.answer}`}</strong>{item.explanation ? <StructuredExplanation text={item.explanation} compact /> : <p>Comparez votre formulation avec la réponse attendue et identifiez la notion essentielle.</p>}<button type="button" className="button light" onClick={() => { setIndex((current) => (current + 1) % prompts.length); setValue(''); setChecked(false); }}>Suivant</button></div>}</div>;
}

function Maze({ content }: { content: Record<string, unknown> }) { const cells = asItems(content.cells); const [position,setPosition] = useState(0); if (cells.length < 4) return <EmptyMechanic />; return <div className="maze-board"><p>Avancez uniquement vers une réponse correcte.</p><div>{cells.map((cell,index) => <button type="button" className={index === position ? 'player-cell' : ''} onClick={() => cell.correct && setPosition(index)} key={index}>{index === position ? '●' : label(cell)}</button>)}</div><strong>{position === cells.length - 1 ? 'Arrivée atteinte !' : 'Cherchez le prochain passage correct.'}</strong></div>; }

type ScenarioDecision = { sceneId:string;sceneTitle:string;choiceId:string;choiceText:string;score:number;maxScore:2 };

function Scenario({ content,activity }: { content: Record<string, unknown>; activity: PlayerActivity }) {
  const scenario = normalizeScenarioContent(content); const [index,setIndex] = useState(0); const [selectedId,setSelectedId] = useState(''); const [validated,setValidated] = useState(false); const [decisions,setDecisions] = useState<ScenarioDecision[]>([]); const [completed,setCompleted] = useState(false); const [firstName,setFirstName] = useState(''); const [lastName,setLastName] = useState(''); const [resultMessage,setResultMessage] = useState(''); const [submitting,setSubmitting] = useState(false); const [startedAt] = useState(() => Date.now());
  const scene = scenario.scenes[index]; if (!scene) return <EmptyMechanic />;
  const choices = stableScenarioChoices(scene.choices,scene.id); const selected = choices.find((choice) => choice.id === selectedId);
  const score = decisions.reduce((total,decision) => total + decision.score,0); const maxScore = Math.max(2,decisions.length * 2); const percentage = Math.round(score / maxScore * 100);
  const masteredSkills = uniqueStrings(decisions.filter((decision) => decision.score === 2).flatMap((decision) => scenario.scenes.find((item) => item.id === decision.sceneId)?.competencies ?? []));
  const improvementSkills = uniqueStrings(decisions.filter((decision) => decision.score < 2).flatMap((decision) => scenario.scenes.find((item) => item.id === decision.sceneId)?.competencies ?? []));
  const validateDecision = () => { if (!selected || validated) return; setDecisions((items) => [...items,{sceneId:scene.id,sceneTitle:scene.title,choiceId:selected.id,choiceText:selected.text,score:selected.score,maxScore:2}]); setValidated(true); };
  const continueScenario = () => {
    if (!selected) return;
    const nextIndex = selected.nextSceneId ? scenario.scenes.findIndex((item) => item.id === selected.nextSceneId) : index + 1;
    if (nextIndex < 0 || nextIndex >= scenario.scenes.length) { setCompleted(true); return; }
    setIndex(nextIndex); setSelectedId(''); setValidated(false);
  };
  const submitResult = async () => {
    if (!activity.id || !firstName.trim() || !lastName.trim()) { setResultMessage(activity.id ? 'Renseignez votre prénom et votre nom.' : 'Ce mode aperçu ne peut pas enregistrer de résultat.'); return; }
    setSubmitting(true); setResultMessage('');
    try { const response = await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activityId:activity.id,firstName,lastName,answers:decisions,score,maxScore,durationSeconds:Math.round((Date.now() - startedAt) / 1000),selfEvaluation:percentage >= 80 ? 'Maîtrisé' : percentage >= 50 ? 'En progression' : 'À renforcer'})}); const payload = await response.json() as {ok?:boolean;data?:{message?:string};error?:{message?:string}}; if (!response.ok || !payload.ok) throw new Error(payload.error?.message || 'Enregistrement impossible.'); setResultMessage(payload.data?.message || 'Votre résultat a été enregistré.'); }
    catch (reason) { setResultMessage(reason instanceof Error ? reason.message : 'Enregistrement impossible.'); }
    finally { setSubmitting(false); }
  };
  if (completed) return <section className="scenario-debrief">
    <header><p className="overline">Mise en situation terminée</p><h3>{scenario.debrief.title}</h3><p>{scenario.debrief.summary}</p></header>
    {scenario.scoreMode !== 'hidden' && <div className="scenario-score">{scenario.scoreMode === 'points' && <strong>{score}<small> / {maxScore} points</small></strong>}<span>{percentage}%</span><p>{percentage >= 80 ? 'Compétences maîtrisées' : percentage >= 50 ? 'Compétences en progression' : 'Points à renforcer'}</p></div>}
    <div className="scenario-debrief-grid"><section><h4>Vos décisions</h4>{decisions.map((decision,indexValue) => { const choice = scenario.scenes.find((item) => item.id === decision.sceneId)?.choices.find((item) => item.id === decision.choiceId); return <div className="scenario-debrief-decision" key={decision.sceneId}><p><span>{indexValue + 1}</span><strong>{decision.sceneTitle}</strong><small>{decision.choiceText}{scenario.scoreMode === 'points' ? ` · ${decision.score}/2` : ''}</small></p>{scenario.feedbackTiming === 'deferred' && choice && <div><strong>Conséquence</strong><p>{choice.consequence}</p><strong>Conduite recommandée</strong><p>{choice.recommendedConduct}</p><ScenarioSources values={choice.sources ?? []} compact /></div>}</div>; })}</section><section><h4>Compétences maîtrisées</h4><ul>{(masteredSkills.length ? masteredSkills : ['Poursuivre l’entraînement pour valider les compétences.']).map((item) => <li key={item}>{item}</li>)}</ul><h4>Compétences à renforcer</h4><ul>{(improvementSkills.length ? improvementSkills : ['Aucun point prioritaire détecté.']).map((item) => <li key={item}>{item}</li>)}</ul><h4>Bonnes pratiques à retenir</h4><ul>{scenario.debrief.bestPractices.map((item) => <li key={item}>{item}</li>)}</ul><h4>Points à retravailler</h4><ul>{scenario.debrief.pointsToReview.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
    {!!scenario.debrief.trainerQuestions.length && <section className="scenario-trainer-questions"><h4>Questions pour le débrief collectif</h4>{scenario.debrief.trainerQuestions.map((item,indexValue) => <p key={item}>{indexValue + 1}. {item}</p>)}</section>}
    <section className="scenario-result-form"><div><h4>Transmettre mon résultat</h4><p>Votre nom et votre progression seront visibles par le formateur.</p></div><label>Prénom<input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Nom<input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><button className="button dark" type="button" onClick={submitResult} disabled={submitting}>{submitting ? 'Enregistrement…' : 'Envoyer mon résultat'}</button>{resultMessage && <p role="status">{resultMessage}</p>}</section>
  </section>;
  return <section className="scenario-board">
    <header className="scenario-progress"><div><p className="overline">Mise en situation · {activity.theme || 'Pratique professionnelle'}</p><h3>{scene.title}</h3></div><div><strong>Situation {index + 1} sur {scenario.scenes.length}</strong><span><i style={{width:`${(index + 1) / scenario.scenes.length * 100}%`}} /></span></div></header>
    <div className="scenario-layout">
      <article className="scenario-main-card">
        {/* Les illustrations de scénarios peuvent provenir de domaines pédagogiques configurés par le formateur. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {scene.imageUrl && <img className="scenario-image" src={scene.imageUrl} alt="Illustration de la situation professionnelle" />}
        <div className="scenario-context-title"><span>{initials(scene.people[0] || scene.learnerRole)}</span><div><strong>La situation</strong><small>{scene.location} · {scene.moment}</small></div></div>
        <p className="scenario-context">{scene.context}</p>{scene.dialogue && <blockquote>{scene.dialogue}</blockquote>}
        <dl className="scenario-facts"><div><dt>Votre rôle</dt><dd>{scene.learnerRole}</dd></div><div><dt>Problème</dt><dd>{scene.problem}</dd></div>{scene.people.length > 0 && <div><dt>Personnes présentes</dt><dd>{scene.people.join(' · ')}</dd></div>}{scene.constraints.length > 0 && <div><dt>Contraintes</dt><dd>{scene.constraints.join(' · ')}</dd></div>}</dl>
        <div className="scenario-decision"><h4>{scene.question}</h4><div className="scenario-choices">{choices.map((choice,choiceIndex) => <button type="button" aria-pressed={selectedId === choice.id} className={selectedId === choice.id ? 'selected' : ''} disabled={validated} onClick={() => setSelectedId(choice.id)} key={choice.id}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice.text}</button>)}</div><button className="button dark scenario-validate" type="button" disabled={!selectedId || validated} onClick={validateDecision}>Valider ma décision</button></div>
        {validated && selected && (scenario.feedbackTiming === 'immediate' ? <ScenarioFeedback choice={selected} onContinue={continueScenario} last={index === scenario.scenes.length - 1} showScore={scenario.scoreMode === 'points'} /> : <section className="scenario-deferred"><span>✓</span><div><strong>Décision enregistrée</strong><p>Le retour détaillé sera présenté dans votre bilan final.</p></div><button className="button dark" type="button" onClick={continueScenario}>{index === scenario.scenes.length - 1 ? 'Voir mon bilan' : 'Situation suivante'} →</button></section>)}
      </article>
      <aside className="scenario-side-card"><section><span>Votre mission</span><p>{scene.mission}</p></section><section><span>Objectif pédagogique</span><p>{scene.objective}</p></section><ScenarioList title="Compétences mobilisées" values={scene.competencies} /><ScenarioList title="Points à observer" values={scene.observationCriteria} />{scenario.showHints && <><ScenarioList title="Informations utiles" values={scene.usefulInformation} /><ScenarioList title="Documents et indices" values={scene.documents} /></>}<ScenarioSources values={scene.sources ?? []} /></aside>
    </div>
  </section>;
}

function ScenarioFeedback({ choice,onContinue,last,showScore }: { choice:ScenarioChoice;onContinue:()=>void;last:boolean;showScore:boolean }) { const status = choice.score === 2 ? 'Décision recommandée' : choice.score === 1 ? 'Décision partiellement adaptée' : 'Décision à risque'; return <section className={`scenario-feedback score-${choice.score}`} role="status"><header><span>{choice.score === 2 ? '✓' : choice.score === 1 ? '!' : '×'}</span><div><small>Retour sur votre décision{showScore ? ` · ${choice.score}/2` : ''}</small><h4>{status}</h4></div></header><p className="scenario-consequence"><strong>Conséquence</strong>{choice.consequence}</p><div className="scenario-feedback-columns">{!!choice.positivePoints.length && <div><strong>Points positifs</strong><ul>{choice.positivePoints.map((item) => <li key={item}>{item}</li>)}</ul></div>}{!!choice.risks.length && <div><strong>Risques</strong><ul>{choice.risks.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div><p><strong>Conduite recommandée</strong>{choice.recommendedConduct}</p><p><strong>Explication pédagogique</strong>{choice.explanation}</p>{choice.source && <p className="scenario-source"><strong>Source</strong>{choice.source}</p>}{!!choice.sources?.length && <ScenarioSources values={choice.sources} compact />}<button className="button dark" type="button" onClick={onContinue}>{last ? 'Voir mon bilan' : 'Continuer la situation'} →</button></section>; }
function ScenarioList({ title,values }: { title:string;values:string[] }) { if (!values.length) return null; return <section><span>{title}</span><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></section>; }
function ScenarioSources({ values,compact = false }: { values:ScenarioCitation[];compact?:boolean }) { if (!values.length) return null; return <section className={`scenario-citations ${compact ? 'compact' : ''}`}><span>Sources vérifiables</span>{values.map((source,index) => <div key={`${source.documentId}-${source.pageNumber}-${index}`}><p>{source.passage || `Information issue de la page ${source.pageNumber}.`}</p><a href={`/api/files/${encodeURIComponent(source.documentId)}?preview=1#page=${source.pageNumber}`} target="_blank" rel="noreferrer">Voir la source · page {source.pageNumber} ↗</a></div>)}</section>; }
function stableScenarioChoices(choices: ScenarioChoice[],seed: string): ScenarioChoice[] { const hash = (value:string) => [...value].reduce((total,letter) => (total * 31 + letter.charCodeAt(0)) >>> 0,2166136261); return [...choices].sort((left,right) => hash(`${seed}-${left.id}`) - hash(`${seed}-${right.id}`)); }
function initials(value:string): string { return value.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join('') || 'MS'; }
function uniqueStrings(values:string[]):string[] { return Array.from(new Set(values.filter(Boolean))); }
function Poll({ content }: { content: Record<string, unknown> }) { const options = (Array.isArray(content.options) ? content.options : []).map(String); const [votes,setVotes] = useState(() => options.map(() => 0)); const total = votes.reduce((sum,vote) => sum + vote,0); return <div className="poll-board"><h3>{String(content.question ?? 'Votre avis ?')}</h3>{options.map((option,index) => <button type="button" onClick={() => setVotes(votes.map((vote,voteIndex) => voteIndex === index ? vote + 1 : vote))} key={option}><span>{option}</span><i style={{ width: `${total ? votes[index] / total * 100 : 0}%` }} /><strong>{votes[index]}</strong></button>)}</div>; }
function InteractiveImage({ content }: { content: Record<string, unknown> }) { const hotspots = asItems(content.hotspots); const [active,setActive] = useState<Item | null>(null); return <div className="image-board" style={{ backgroundImage: `linear-gradient(rgba(11,59,51,.15),rgba(11,59,51,.15)), url(${String(content.imageUrl ?? '')})` }}>{hotspots.map((hotspot,index) => <button type="button" style={{ left: `${20 + index * 18}%`, top: `${25 + (index % 2) * 35}%` }} onClick={() => setActive(hotspot)} key={index}>{index + 1}</button>)}{active && <p className="hotspot-popover"><strong>{label(active)}</strong><br />{active.answer}</p>}</div>; }
function FlyingFruits({ content }: { content: Record<string, unknown> }) { const prompts = (Array.isArray(content.prompts) ? content.prompts : []) as Array<{ question?: string; options?: Array<{ label?: string; correct?: boolean }> }>; const prompt = prompts[0]; const [message,setMessage] = useState(''); if (!prompt) return <EmptyMechanic />; return <div className="flying-board"><h3>{prompt.question}</h3><div>{(prompt.options ?? []).map((option,index) => <button style={{ animationDelay: `${index * .35}s` }} type="button" onClick={() => setMessage(option.correct ? 'Bonne réponse !' : 'Essaie encore.')} key={index}>🍋 {option.label}</button>)}</div><p role="status">{message}</p></div>; }
function EmptyMechanic() { return <div className="empty-mechanic"><strong>Cette activité doit être complétée.</strong><p>Modifiez son contenu avant de la publier.</p></div>; }
