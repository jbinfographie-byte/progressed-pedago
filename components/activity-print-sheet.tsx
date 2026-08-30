import { ACTIVITY_TYPES, type ActivityType } from '@/lib/activity-types';
/* eslint-disable @next/next/no-img-element */
import { normalizeScenarioContent } from '@/lib/scenario';
import { courseImagesFromContent, type CourseImage, type CourseImagePlacement } from '@/lib/course-images';

export type PrintableActivity = {
  type: ActivityType;
  title: string;
  theme?: string;
  audience?: string;
  level?: 'debutant' | 'intermediaire' | 'avance';
  objectives?: string[];
  durationMinutes?: number;
  instructions?: string;
  explanation?: string;
  correction?: string;
  sources?: Array<{ title: string; organization?: string; url: string; usedFor?: string }>;
  content: Record<string, unknown>;
};

type Item = { label?: string; text?: string; answer?: string; category?: string; correct?: boolean; front?: string; back?: string; pair?: string; consequence?: string };

const items = (value: unknown): Item[] => Array.isArray(value) ? value.filter((item): item is Item => Boolean(item && typeof item === 'object')) : [];
const itemLabel = (item: Item) => String(item.label ?? item.text ?? item.front ?? 'Élément');
const formatLabel = (type: ActivityType) => ACTIVITY_TYPES.find(([candidate]) => candidate === type)?.[1] ?? type;
const levelLabel = (level?: PrintableActivity['level']) => level === 'avance' ? 'Avancé' : level === 'intermediaire' ? 'Intermédiaire' : 'Débutant';

export function StructuredExplanation({ text, compact = false }: { text: string; compact?: boolean }) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return <div className={`structured-explanation ${compact ? 'compact' : ''}`}>{lines.map((line,index) => {
    if (/^#{1,3}\s+/.test(line)) return <h4 key={index}>{line.replace(/^#{1,3}\s+/, '')}</h4>;
    if (/^(à retenir|comprendre|méthode|exemple|erreurs? à éviter|mémo|point clé)\s*:/i.test(line)) {
      const [heading,...rest] = line.split(':');
      return <div className="explanation-highlight" key={index}><strong>{heading}</strong><p>{rest.join(':').trim()}</p></div>;
    }
    if (/^[-•]\s+/.test(line)) return <p className="explanation-bullet" key={index}>{line.replace(/^[-•]\s+/, '')}</p>;
    return <p key={index}>{line}</p>;
  })}</div>;
}

export function ActivityPrintSheet({ activity }: { activity: PrintableActivity }) {
  const sources = activity.sources ?? [];
  const courseImages = courseImagesFromContent(activity.content).filter((image) => image.status === 'validated');
  return <article className="print-sheet" aria-hidden="true">
    <header className="print-cover">
      <div className="print-brand"><span>P</span><div><strong>Progressed Pédago</strong><small>Support pédagogique prêt à animer</small></div></div>
      <span className="print-format">{formatLabel(activity.type)}</span>
      <p>{activity.theme || 'Activité pédagogique'}</p>
      <h1>{activity.title}</h1>
      <div className="print-meta"><span><b>Public</b>{activity.audience || 'Adultes en formation'}</span><span><b>Niveau</b>{levelLabel(activity.level)}</span><span><b>Durée</b>{activity.durationMinutes ? `${activity.durationMinutes} min` : 'À adapter'}</span></div>
      <PrintCourseImages images={courseImages} placement="cover" />
    </header>

    <section className="print-identity"><span>Prénom et nom : <i /></span><span>Date : <i /></span><span>Groupe : <i /></span></section>
    <PrintCourseImages images={courseImages} placement="introduction" />

    <section className="print-introduction print-block">
      <div><span className="print-number">1</span><div><p className="print-kicker">Objectifs</p><h2>Ce que vous allez apprendre</h2></div></div>
      <ul>{(activity.objectives?.length ? activity.objectives : ['Comprendre et appliquer les notions essentielles de cette activité.']).map((objective,index) => <li key={index}>{objective}</li>)}</ul>
      {activity.instructions && <div className="print-instruction"><strong>Consigne de travail</strong><p>{activity.instructions}</p></div>}
    </section>

    {activity.explanation && <section className="print-course print-block">
      <div><span className="print-number">2</span><div><p className="print-kicker">Mini-cours</p><h2>Comprendre avant de pratiquer</h2></div></div>
      <PrintCourseImages images={courseImages} placement="explanation" />
      <StructuredExplanation text={activity.explanation} />
      <PrintCourseImages images={courseImages} placement="example" />
      <PrintCourseImages images={courseImages} placement="procedure" />
    </section>}

    <section className="print-exercise print-block print-page-start">
      <div><span className="print-number">3</span><div><p className="print-kicker">Exercice</p><h2>{formatLabel(activity.type)}</h2></div></div>
      <PrintCourseImages images={courseImages} placement="scenario" />
      <PrintableMechanic type={activity.type} content={activity.content} />
    </section>

    <section className="print-correction print-block print-page-start">
      <div className="print-teacher-label">Corrigé formateur · à séparer avant distribution</div>
      <div><span className="print-number">4</span><div><p className="print-kicker">Correction expliquée</p><h2>Réponses et points de vigilance</h2></div></div>
      <PrintableAnswers type={activity.type} content={activity.content} />
      {activity.correction && <div className="print-global-correction"><strong>Synthèse de la correction</strong><StructuredExplanation text={activity.correction} compact /></div>}
      <PrintCourseImages images={courseImages} placement="synthesis" />
      {!!sources.length && <div className="print-sources"><strong>Références utilisées</strong>{sources.map((source,index) => <p key={index}>{source.organization ? `${source.organization} — ` : ''}{source.title}{source.usedFor ? ` · ${source.usedFor}` : ''}</p>)}</div>}
    </section>
    <footer className="print-footer"><span>Progressed Pédago</span><span>{activity.title}</span></footer>
  </article>;
}

function PrintCourseImages({images,placement}:{images:CourseImage[];placement:CourseImagePlacement}) {
  const visible=images.filter((image)=>image.placement===placement); if(!visible.length)return null;
  return <div className={`print-course-images print-placement-${placement}`}>{visible.map((image)=><figure key={image.id}><img src={image.url} alt={image.altText}/>{image.caption&&<figcaption>{image.caption}</figcaption>}</figure>)}</div>;
}

function PrintableMechanic({ type,content }: { type: ActivityType; content: Record<string,unknown> }) {
  if (type === 'quiz' || type === 'tv-quiz') {
    const questions = (Array.isArray(content.questions) ? content.questions : []) as Array<{ question?: string; choices?: string[] }>;
    return <div className="print-question-list">{questions.map((question,index) => <section className="print-question" key={index}><h3><span>{index + 1}</span>{question.question}</h3><div className="print-choices">{(question.choices ?? []).map((choice,choiceIndex) => <p key={choiceIndex}><i>{String.fromCharCode(65 + choiceIndex)}</i>{choice}<b /></p>)}</div></section>)}</div>;
  }
  if (type === 'true-false') {
    const statements = (Array.isArray(content.statements) ? content.statements : []) as Array<{ text?: string }>;
    return <div className="print-question-list">{statements.map((statement,index) => <section className="print-question print-binary" key={index}><h3><span>{index + 1}</span>{statement.text}</h3><div><b>□ Vrai</b><b>□ Faux</b><i>Justification : </i></div></section>)}</div>;
  }
  if (['flip-tiles','revision-cards','random-cards','memory-cards','pair-or-not'].includes(type)) {
    return <div className="print-card-grid">{items(content.cards).map((card,index) => <section key={index}><span>Carte {index + 1}</span><h3>{String(card.front ?? card.label ?? 'Question')}</h3><div>Réponse : ....................................................................</div></section>)}</div>;
  }
  if (type === 'challenge-wheel' || type === 'question-wheel') return <PromptList values={items(content.sectors).map(itemLabel)} />;
  if (type === 'word-search') return <PrintWordSearch content={content} />;
  if (type === 'crossword') return <PrintCrossword content={content} />;
  if (type === 'hangman') return <div className="print-hangman"><p>Proposez les lettres une par une, puis complétez le mot.</p><strong>{String((Array.isArray(content.words) ? content.words[0] : '') ?? '').replace(/./g,'_ ')}</strong><div>Indices / lettres proposées :</div></div>;
  if (['spell-word','ranking','unravel','anagram'].includes(type)) {
    const values = items(content.items).map(itemLabel);
    return <div className="print-ordering">{(values.length ? values : String(content.word ?? content.sentence ?? '').split(' ')).map((value,index) => <p key={index}><i>{index + 1}</i><span>{value}</span><b>Ordre : ____</b></p>)}</div>;
  }
  if (['drag-drop','matching','categories','labelled-diagram'].includes(type)) {
    const categories = items(content.categories ?? content.zones);
    return <><div className="print-item-bank"><strong>Éléments à classer</strong><p>{items(content.items).map(itemLabel).join(' · ')}</p></div><div className="print-category-grid">{categories.map((category,index) => <section key={index}><h3>{itemLabel(category)}</h3><div /></section>)}</div></>;
  }
  if (type === 'type-answer') return <PromptList values={((Array.isArray(content.prompts) ? content.prompts : []) as Array<{question?:string}>).map((item) => String(item.question ?? 'Question'))} />;
  if (type === 'maze') return <div className="print-maze">{items(content.cells).map((cell,index) => <span key={index}>{index === 0 ? 'Départ' : itemLabel(cell)}</span>)}</div>;
  if (type === 'scenario') {
    const scenario = normalizeScenarioContent(content);
    return <div className="print-question-list print-scenario-list">{scenario.scenes.map((scene,index) => <section className="print-question print-scenario-scene" key={scene.id}><h3><span>{index + 1}</span>{scene.title}</h3><div className="print-scenario-context"><p><strong>Lieu et moment</strong>{scene.location} · {scene.moment}</p><p><strong>Votre rôle</strong>{scene.learnerRole}</p><p><strong>Mission</strong>{scene.mission}</p><p><strong>Situation</strong>{scene.context}</p>{scene.dialogue && <blockquote>{scene.dialogue}</blockquote>}</div><h4>{scene.question}</h4><div className="print-choices">{scene.choices.map((choice,choiceIndex) => <p key={choice.id}><i>{String.fromCharCode(65 + choiceIndex)}</i>{choice.text}<b /></p>)}</div><div className="print-scenario-justification"><strong>Je justifie ma décision</strong><span /><span /></div>{!!scene.sources?.length && <p className="print-scenario-sources"><strong>Références :</strong> {scene.sources.map((source) => `document ${source.documentId.slice(0,8)} · p. ${source.pageNumber}`).join(' ; ')}</p>}</section>)}</div>;
  }
  if (type === 'live-poll') return <PromptList title={String(content.question ?? 'Votre avis')} values={(Array.isArray(content.options) ? content.options : []).map(String)} checkboxes />;
  if (type === 'interactive-image') return <div className="print-image-activity"><div>Zone de l’image / du schéma</div><ol>{items(content.hotspots).map((hotspot,index) => <li key={index}>{itemLabel(hotspot)} : ............................................................</li>)}</ol></div>;
  if (type === 'flying-fruits') {
    const prompts = (Array.isArray(content.prompts) ? content.prompts : []) as Array<{question?:string;options?:Array<{label?:string}>}>;
    return <div className="print-question-list">{prompts.map((prompt,index) => <section className="print-question" key={index}><h3><span>{index + 1}</span>{prompt.question}</h3><p>{(prompt.options ?? []).map((option) => `□ ${option.label}`).join('    ')}</p></section>)}</div>;
  }
  return <PromptList values={items(content.items).map(itemLabel)} />;
}

function PrintableAnswers({ type,content }: { type: ActivityType; content: Record<string,unknown> }) {
  if (type === 'quiz' || type === 'tv-quiz') {
    const questions = (Array.isArray(content.questions) ? content.questions : []) as Array<{ question?: string; choices?: string[]; correctIndex?: number; explanation?: string }>;
    return <div className="print-answer-list">{questions.map((question,index) => <section key={index}><h3>{index + 1}. {question.question}</h3><p className="print-answer"><strong>Réponse :</strong> {String.fromCharCode(65 + Number(question.correctIndex ?? 0))} — {question.choices?.[Number(question.correctIndex ?? 0)]}</p>{question.explanation && <StructuredExplanation text={question.explanation} compact />}</section>)}</div>;
  }
  if (type === 'true-false') {
    const statements = (Array.isArray(content.statements) ? content.statements : []) as Array<{ text?: string; answer?: boolean; explanation?: string }>;
    return <div className="print-answer-list">{statements.map((statement,index) => <section key={index}><h3>{index + 1}. {statement.answer ? 'Vrai' : 'Faux'} — {statement.text}</h3>{statement.explanation && <StructuredExplanation text={statement.explanation} compact />}</section>)}</div>;
  }
  if (['flip-tiles','revision-cards','random-cards','memory-cards','pair-or-not'].includes(type)) return <div className="print-answer-list">{items(content.cards).map((card,index) => <section key={index}><h3>{index + 1}. {String(card.front ?? card.label ?? 'Carte')}</h3><p>{String(card.back ?? card.answer ?? 'Réponse à compléter')}</p></section>)}</div>;
  if (type === 'type-answer') {
    const prompts = (Array.isArray(content.prompts) ? content.prompts : []) as Array<{question?:string;answer?:string;explanation?:string}>;
    return <div className="print-answer-list">{prompts.map((prompt,index) => <section key={index}><h3>{index + 1}. {prompt.question}</h3><p className="print-answer"><strong>Réponse :</strong> {prompt.answer}</p>{prompt.explanation && <StructuredExplanation text={prompt.explanation} compact />}</section>)}</div>;
  }
  if (type === 'scenario') {
    const scenario = normalizeScenarioContent(content);
    return <div className="print-answer-list print-scenario-answers">{scenario.scenes.map((scene,index) => <section key={scene.id}><h3>{index + 1}. {scene.title}</h3><p><strong>Objectif :</strong> {scene.objective}</p>{scene.choices.map((choice,choiceIndex) => <div className={`print-scenario-answer score-${choice.score}`} key={choice.id}><p><strong>{String.fromCharCode(65 + choiceIndex)} · {choice.score}/2 — {choice.text}</strong></p><p><b>Conséquence :</b> {choice.consequence}</p><p><b>Conduite recommandée :</b> {choice.recommendedConduct}</p><p>{choice.explanation}</p>{!!choice.sources?.length && <p><b>Sources :</b> {choice.sources.map((source) => `p. ${source.pageNumber}${source.passage ? ` — ${source.passage}` : ''}`).join(' ; ')}</p>}</div>)}</section>)}<section className="print-scenario-debrief"><h3>{scenario.debrief.title}</h3><p>{scenario.debrief.summary}</p><strong>Bonnes pratiques</strong><ul>{scenario.debrief.bestPractices.map((item) => <li key={item}>{item}</li>)}</ul><strong>Questions de débrief</strong><ul>{scenario.debrief.trainerQuestions.map((item) => <li key={item}>{item}</li>)}</ul></section></div>;
  }
  const answers = items(content.items).filter((item) => item.answer || item.category || item.correct);
  return answers.length ? <div className="print-answer-list">{answers.map((answer,index) => <section key={index}><h3>{index + 1}. {itemLabel(answer)}</h3><p>{String(answer.answer ?? answer.category ?? (answer.correct ? 'Correct' : ''))}</p></section>)}</div> : <p className="print-adaptation-note">Utilisez la synthèse ci-dessous pour animer la correction collective et demander aux participants de justifier leurs choix.</p>;
}

function PromptList({ values,title,checkboxes = false }: { values: string[]; title?: string; checkboxes?: boolean }) {
  return <div className="print-prompt-list">{title && <h3>{title}</h3>}{values.map((value,index) => <section key={index}><strong>{checkboxes ? '□' : `${index + 1}.`} {value}</strong><div /></section>)}</div>;
}

function PrintWordSearch({ content }: { content: Record<string,unknown> }) {
  const grid = (Array.isArray(content.grid) ? content.grid : []) as Array<string[] | string>;
  const rows = grid.map((row) => Array.isArray(row) ? row : String(row).split(''));
  return <div className="print-word-search"><div className="print-letter-grid" style={{ gridTemplateColumns:`repeat(${rows[0]?.length || 1}, 1fr)` }}>{rows.flatMap((row,rowIndex) => row.map((letter,columnIndex) => <span key={`${rowIndex}-${columnIndex}`}>{letter}</span>))}</div><aside><strong>Mots à trouver</strong>{(Array.isArray(content.words) ? content.words : []).map((word,index) => <p key={index}>□ {String(word)}</p>)}</aside></div>;
}

function PrintCrossword({ content }: { content: Record<string,unknown> }) {
  const grid = (Array.isArray(content.grid) ? content.grid : []) as Array<string[] | string>;
  const rows = grid.map((row) => Array.isArray(row) ? row : String(row).split(''));
  return <div className="print-crossword"><div className="print-crossword-grid" style={{ gridTemplateColumns:`repeat(${rows[0]?.length || 1}, 8mm)` }}>{rows.flatMap((row,rowIndex) => row.map((cell,columnIndex) => <span className={cell === '#' ? 'blocked' : ''} key={`${rowIndex}-${columnIndex}`} />))}</div><ol>{items(content.clues).map((clue,index) => <li key={index}>{itemLabel(clue)}</li>)}</ol></div>;
}
