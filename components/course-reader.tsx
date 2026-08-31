'use client';
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import type { CoursePage } from '@/lib/course-pages';
import type { CourseImage } from '@/lib/course-images';

const KIND_LABELS:Record<CoursePage['kind'],string>={cover:'Couverture',introduction:'Introduction',chapter:'Chapitre',synthesis:'Synthèse',exercises:'Exercices'};

export function CourseReader({pages,images}:{pages:CoursePage[];images:CourseImage[]}) {
  const [index,setIndex]=useState(0); const safeIndex=Math.min(index,Math.max(0,pages.length-1)); const page=pages[safeIndex];
  if(!page)return null;
  const go=(next:number)=>{setIndex(Math.min(pages.length-1,Math.max(0,next)));document.querySelector('.course-reader')?.scrollIntoView({behavior:'smooth',block:'start'});};
  return <section className="course-reader" aria-label="Cours multipage"><aside className="course-toc"><div><span>Sommaire</span><strong>{pages.length} pages</strong></div><nav>{pages.map((item,itemIndex)=><button className={itemIndex===safeIndex?'active':''} type="button" aria-current={itemIndex===safeIndex?'page':undefined} onClick={()=>go(itemIndex)} key={item.id}><i>{itemIndex+1}</i><span><b>{item.title}</b><small>{KIND_LABELS[item.kind]}</small></span></button>)}</nav></aside><article className={`course-digital-page kind-${page.kind}`}><header><p>{KIND_LABELS[page.kind]} · Page {safeIndex+1} sur {pages.length}</p><h3>{page.title}</h3>{page.lead&&<div>{page.lead}</div>}</header><CoursePageContent page={page} images={images}/><nav className="course-page-navigation" aria-label="Navigation entre les pages"><button className="button light" type="button" disabled={safeIndex===0} onClick={()=>go(safeIndex-1)}>← Page précédente</button><span><b>{safeIndex+1}</b> / {pages.length}</span><button className="button dark" type="button" disabled={safeIndex===pages.length-1} onClick={()=>go(safeIndex+1)}>Page suivante →</button></nav></article></section>;
}

export function CoursePageContent({page,images,print=false}:{page:CoursePage;images:CourseImage[];print?:boolean}) {
  const visible=images.filter((image)=>image.status==='validated'&&(image.pageId===page.id||(!image.pageId&&fallbackPlacement(page,image.placement))));
  return <div className={print?'course-page-content print-course-page-content':'course-page-content'}>
    {!!visible.length&&<div className="course-page-images">{visible.map((image)=><figure className={`course-image-figure width-${image.width} fit-${image.fit}`} key={image.id}><img src={image.url} alt={image.altText} style={{objectPosition:`${image.focalX}% ${image.focalY}%`}}/>{image.caption&&<figcaption>{image.caption}</figcaption>}</figure>)}</div>}
    {page.sections.map((section)=><section className="course-section" key={section.heading}><h4>{section.heading}</h4>{paragraphs(section.body).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section>)}
    {!!page.definitions.length&&<section className="course-definitions"><h4>Définitions</h4><dl>{page.definitions.map((item)=><div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}</dl></section>}
    {!!page.examples.length&&<section className="course-examples"><h4>Exemples professionnels</h4>{page.examples.map((item)=><article key={item.title}><strong>{item.title}</strong><p>{item.description}</p></article>)}</section>}
    {!!page.keyPoints.length&&<section className="course-key-points"><h4>Points importants à retenir</h4><ul>{page.keyPoints.map((item)=><li key={item}>{item}</li>)}</ul></section>}
    {(page.practice.title||page.practice.instructions)&&<CoursePracticeBlock key={page.id} page={page} print={print}/>}
    {!!page.sourceRefs.length&&<footer className="course-source-refs"><strong>Pages sources vérifiées :</strong> {page.sourceRefs.map((source,index)=><a href={`/api/files/${encodeURIComponent(source.documentId)}?preview=1#page=${source.pageNumber}`} target="_blank" rel="noreferrer" key={`${source.documentId}-${source.pageNumber}-${index}`}>p. {source.pageNumber}</a>)}</footer>}
  </div>;
}

function CoursePracticeBlock({page,print}:{page:CoursePage;print:boolean}) {
  const practice=page.practice; const selectable=(practice.type==='quiz'||practice.type==='true-false')&&practice.choices.length>1;
  const [selected,setSelected]=useState<number|null>(null); const [response,setResponse]=useState(''); const [revealed,setRevealed]=useState(false);
  const correct=selected===practice.correctIndex;
  if(print)return <section className="course-practice course-practice-print"><span>Exercice de fin de leçon</span><h4>{practice.title}</h4><p>{practice.instructions}</p>{practice.question&&<strong className="course-practice-question">{practice.question}</strong>}{selectable?<div className="course-practice-print-choices">{practice.choices.map((choice,index)=><p key={choice}>□ {String.fromCharCode(65+index)}. {choice}</p>)}</div>:<div className="course-practice-answer-lines"><i/><i/><i/></div>}</section>;
  return <section className="course-practice"><span>Exercice de fin de leçon · {practiceLabel(practice.type)}</span><h4>{practice.title}</h4><p>{practice.instructions}</p>{practice.question&&<strong className="course-practice-question">{practice.question}</strong>}
    {selectable?<><div className="course-practice-choices">{practice.choices.map((choice,index)=><button className={`${selected===index?'selected':''} ${revealed?(index===practice.correctIndex?'correct':selected===index?'incorrect':''):''}`} type="button" disabled={revealed} onClick={()=>setSelected(index)} key={`${choice}-${index}`}><i>{String.fromCharCode(65+index)}</i><span>{choice}</span></button>)}</div><button className="button dark course-practice-submit" type="button" disabled={selected===null||revealed} onClick={()=>setRevealed(true)}>Valider ma réponse</button></>:<><textarea rows={4} value={response} disabled={revealed} onChange={(event)=>setResponse(event.target.value)} placeholder="Écrivez votre réponse ou les étapes que vous appliqueriez…"/><button className="button dark course-practice-submit" type="button" disabled={revealed||(!response.trim()&&!practice.answer)} onClick={()=>setRevealed(true)}>Voir la réponse expliquée</button></>}
    {revealed&&<div className={`course-practice-feedback ${selectable?(correct?'success':'warning'):'success'}`} role="status"><strong>{selectable?(correct?'Bonne réponse.':'À revoir.'):'Proposition de correction'}</strong><p><b>Réponse attendue :</b> {practice.answer}</p>{practice.explanation&&<p>{practice.explanation}</p>}</div>}
  </section>;
}

function practiceLabel(type:CoursePage['practice']['type']) { return type==='quiz'?'Quiz':type==='true-false'?'Vrai ou faux':type==='scenario'?'Mise en situation':'Réflexion'; }

function paragraphs(value:string){return value.split(/\n{2,}|\n(?=[A-ZÀ-ÖØ-Þ])/).map((item)=>item.trim()).filter(Boolean);}
function fallbackPlacement(page:CoursePage,placement:CourseImage['placement']) {
  if(page.kind==='cover')return placement==='cover'; if(page.kind==='introduction')return placement==='introduction'; if(page.kind==='synthesis')return placement==='synthesis'; if(page.kind==='exercises')return placement==='exercise';
  return ['explanation','example','procedure','scenario'].includes(placement);
}
