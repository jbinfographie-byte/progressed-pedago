'use client';

import { FormEvent, useState } from 'react';
import { ACTIVITY_TYPES, type ActivityType } from '@/lib/activity-types';
import { buildManualPedagogy } from '@/lib/manual-pedagogy';

type Question = { question: string; choices: string[]; correctIndex: number; explanation: string };
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export function ManualActivityDialog({ type,onClose,onCreated }: { type: ActivityType; onClose: () => void; onCreated: () => void }) {
  const definition = ACTIVITY_TYPES.find(([candidate]) => candidate === type)!;
  const [questions,setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [contentJson,setContentJson] = useState(JSON.stringify(starterContent(type),null,2));
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const isQuiz = type === 'quiz' || type === 'tv-quiz';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    try {
      const content = isQuiz ? quizContent(questions) : JSON.parse(contentJson) as Record<string,unknown>;
      const title = String(form.get('title') ?? '').trim();
      const objectives = String(form.get('objectives') ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
      const automatic = buildManualPedagogy(type,title,objectives,content);
      const response = await fetch('/api/activities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        type,title,theme:String(form.get('theme') ?? '').trim(),audience:String(form.get('audience') ?? '').trim(),level:form.get('level'),objectives,
        durationMinutes:Number(form.get('durationMinutes')),instructions:String(form.get('instructions') ?? '').trim(),
        explanation:String(form.get('explanation') ?? '').trim() || automatic.explanation,
        correction:String(form.get('correction') ?? '').trim() || automatic.correction,
        sources:[],content,status:'draft',
      })});
      const payload = await response.json() as ApiResult<unknown>;
      if (!payload.ok) throw new Error(payload.error.message);
      onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="manual-title"><form className="modal-card studio-card manual-activity-card" onSubmit={submit}>
    <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
    <p className="overline">Création manuelle · {definition[1]}</p><h2 id="manual-title">Construire l’activité simplement.</h2>
    <p>Renseignez le contenu pédagogique : le mini-cours, les explications et le corrigé A4 seront composés automatiquement.</p>
    <section className="manual-section"><div className="manual-section-title"><span>1</span><div><strong>Cadre pédagogique</strong><small>Les informations visibles dans le cours et sur le support imprimé.</small></div></div>
      <div className="form-row"><label>Titre<input name="title" required placeholder="Ex. Prévenir les risques de chute" /></label><label>Thème<input name="theme" required placeholder="Ex. Sécurité au travail" /></label><label>Durée<input name="durationMinutes" type="number" min="1" max="480" defaultValue="10" required /></label></div>
      <div className="form-row two"><label>Public concerné<input name="audience" placeholder="Ex. Agents de propreté débutants" /></label><label>Niveau<select name="level"><option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option></select></label></div>
      <label>Objectifs pédagogiques, un par ligne<textarea name="objectives" rows={3} required placeholder={'Identifier le risque de chute\nMettre en place un balisage adapté'} /></label>
      <label>Consigne donnée aux participants<textarea name="instructions" rows={2} placeholder="Ex. Répondez aux questions puis justifiez chaque choix." /></label>
    </section>

    <section className="manual-section"><div className="manual-section-title"><span>2</span><div><strong>Contenu de l’activité</strong><small>{isQuiz ? 'Ajoutez les questions sans écrire de code.' : 'Le contenu de ce format peut être ajusté dans l’éditeur avancé.'}</small></div></div>
      {isQuiz ? <QuizEditor questions={questions} onChange={setQuestions} /> : <details className="advanced-editor"><summary>Modifier le contenu du jeu</summary><p>Cette zone avancée conserve la structure nécessaire au fonctionnement du jeu.</p><textarea aria-label="Contenu avancé du jeu" className="code-editor" value={contentJson} onChange={(event) => setContentJson(event.target.value)} rows={12} spellCheck={false} /></details>}
    </section>

    <section className="manual-section automatic-pedagogy"><div className="manual-section-title"><span>3</span><div><strong>Cours et corrigé automatiques</strong><small>Vous pouvez les personnaliser, mais ils ne resteront plus vides.</small></div></div>
      <div className="automatic-note"><span>✓</span><p><strong>Composition automatique activée</strong>Les réponses et vos explications serviront à créer le mini-cours affiché avant le jeu ainsi que le corrigé formateur A4.</p></div>
      <details className="optional-content"><summary>Personnaliser le mini-cours et le corrigé</summary><label>Mini-cours personnalisé<textarea name="explanation" rows={5} placeholder="Laissez vide pour composer automatiquement le cours à partir de l’activité." /></label><label>Correction générale personnalisée<textarea name="correction" rows={4} placeholder="Laissez vide pour créer automatiquement les réponses attendues et les critères de réussite." /></label></details>
    </section>
    {error && <p className="form-message error" role="status">{error}</p>}
    <div className="modal-actions manual-actions"><button className="button light" type="button" onClick={onClose}>Annuler</button><button className="button dark" type="submit" disabled={busy}>{busy ? 'Création du support…' : 'Créer l’activité et son support A4'}</button></div>
  </form></div>;
}

function QuizEditor({ questions,onChange }: { questions: Question[]; onChange: (questions: Question[]) => void }) {
  const change = (index: number, next: Partial<Question>) => onChange(questions.map((question,questionIndex) => questionIndex === index ? { ...question,...next } : question));
  return <div className="quiz-editor">{questions.map((question,index) => <article className="quiz-question-editor" key={index}>
    <header><span>Question {index + 1}</span>{questions.length > 1 && <button type="button" onClick={() => onChange(questions.filter((_,questionIndex) => questionIndex !== index))}>Supprimer</button>}</header>
    <label>Question<input value={question.question} onChange={(event) => change(index,{question:event.target.value})} required placeholder="Ex. Pourquoi faut-il baliser une zone humide ?" /></label>
    <fieldset><legend>Réponses proposées · cochez la bonne réponse</legend><div className="quiz-choice-editor">{question.choices.map((choice,choiceIndex) => <label className={question.correctIndex === choiceIndex ? 'correct-choice' : ''} key={choiceIndex}><input type="radio" name={`correct-${index}`} checked={question.correctIndex === choiceIndex} onChange={() => change(index,{correctIndex:choiceIndex})} /><span>{String.fromCharCode(65 + choiceIndex)}</span><input aria-label={`Réponse ${choiceIndex + 1}`} value={choice} onChange={(event) => change(index,{choices:question.choices.map((item,itemIndex) => itemIndex === choiceIndex ? event.target.value : item)})} required placeholder={`Réponse ${choiceIndex + 1}`} /></label>)}</div></fieldset>
    <label>Explication après la réponse<textarea rows={3} value={question.explanation} onChange={(event) => change(index,{explanation:event.target.value})} placeholder="Expliquez la règle, donnez un exemple et indiquez le risque évité." /></label>
  </article>)}<button className="add-question" type="button" onClick={() => onChange([...questions,emptyQuestion()])}>＋ Ajouter une question</button></div>;
}

function emptyQuestion(): Question { return { question:'',choices:['','',''],correctIndex:0,explanation:'' }; }
function quizContent(questions: Question[]) { return { questions:questions.map((item) => ({ question:item.question.trim(),choices:item.choices.map((choice) => choice.trim()),correctIndex:item.correctIndex,explanation:item.explanation.trim() })) }; }

function starterContent(type: ActivityType): Record<string,unknown> {
  const items = [{label:'Préparer le matériel',category:'Avant'},{label:'Baliser la zone',category:'Avant'},{label:'Contrôler le résultat',category:'Après'}];
  if (type === 'true-false') return { statements:[{text:'Les produits chimiques peuvent être mélangés pour gagner du temps.',answer:false,explanation:'Un mélange peut produire une réaction dangereuse.'}] };
  if (type === 'word-search') return { grid:['BALISAGE','PRODUITS','SECURITE','MATERIEL'],words:['BALISAGE','SECURITE'] };
  if (type === 'crossword') return { grid:['....#','.#...','.....'],clues:[{label:'Protection individuelle'},{label:'Signalement d’une zone humide'}] };
  if (type === 'hangman') return { words:['BALISAGE'] };
  if (['flip-tiles','revision-cards','random-cards','memory-cards'].includes(type)) return { cards:[{front:'Que signifie EPI ?',back:'Équipement de protection individuelle'},{front:'Pourquoi baliser ?',back:'Pour prévenir les chutes'}] };
  if (type === 'pair-or-not') return { cards:[{front:'Gants',back:'Protection des mains',pair:'epi'},{front:'Protection des mains',back:'Gants',pair:'epi'},{front:'Balai',back:'Matériel manuel',pair:'materiel'}] };
  if (type === 'type-answer') return { prompts:[{question:'Quel équipement protège les mains ?',answer:'des gants',explanation:'Les gants adaptés protègent du contact avec les produits.'}] };
  if (type === 'interactive-image') return { imageUrl:'',hotspots:[{label:'Poignée',answer:'Permet de guider la machine'},{label:'Disque',answer:'Agit sur le sol'}] };
  if (type === 'scenario') return { steps:[{situation:'Vous constatez un sol humide sans balisage. Que faites-vous ?',choices:[{label:'Baliser immédiatement',consequence:'Bonne décision : le risque est maîtrisé.',next:0},{label:'Attendre',consequence:'Le risque de chute reste présent.'}]}] };
  if (type === 'live-poll') return { question:'Quelle notion souhaitez-vous retravailler ?',options:['Sécurité','Dosage','Matériel'] };
  if (type === 'challenge-wheel' || type === 'question-wheel') return { sectors:[{label:type === 'question-wheel' ? 'Pourquoi faut-il baliser la zone ?' : 'Montrez le bon geste de balisage'},{label:type === 'question-wheel' ? 'Comment vérifier un dosage ?' : 'Expliquez le dosage'},{label:type === 'question-wheel' ? 'Quels sont les trois EPI utiles ?' : 'Citez trois EPI'},{label:type === 'question-wheel' ? 'Quel risque voyez-vous ?' : 'Repérez un risque'}] };
  if (type === 'maze') return { cells:[{label:'Départ',correct:true},{label:'Baliser',correct:true},{label:'Mélanger',correct:false},{label:'Contrôler',correct:true}] };
  if (type === 'flying-fruits') return { prompts:[{question:'Quel choix protège les mains ?',options:[{label:'Les gants',correct:true},{label:'Le parfum',correct:false},{label:'La cire',correct:false}]}] };
  if (type === 'categories') return { categories:[{label:'Avant'},{label:'Après'}],items };
  if (['spell-word','anagram'].includes(type)) return { word:'SECURITE',items:'SECURITE'.split('').map((letter) => ({label:letter})) };
  if (type === 'unravel') return { sentence:'Je balise la zone avant de laver',items:'Je balise la zone avant de laver'.split(' ').map((word) => ({label:word})) };
  return { categories:[{label:'Avant'},{label:'Après'}],zones:[{label:'Avant'},{label:'Après'}],items };
}
