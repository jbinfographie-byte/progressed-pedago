export const COURSE_LENGTHS = ['short','intermediate','complete','custom'] as const;
export const COURSE_PAGE_KINDS = ['cover','introduction','chapter','synthesis','exercises'] as const;

export type CourseLength = typeof COURSE_LENGTHS[number];
export type CoursePageKind = typeof COURSE_PAGE_KINDS[number];
export type CoursePageSource = { documentId:string; pageNumber:number };
export type CoursePage = {
  id:string;
  title:string;
  kind:CoursePageKind;
  lead:string;
  sections:Array<{heading:string;body:string}>;
  definitions:Array<{term:string;definition:string}>;
  examples:Array<{title:string;description:string}>;
  keyPoints:string[];
  practice:{title:string;instructions:string};
  sourceRefs:CoursePageSource[];
};

const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const list=(value:unknown,max=20)=>Array.isArray(value)?value.map((item)=>clean(item,1_000)).filter(Boolean).slice(0,max):[];

export function normalizeCourseLength(value:unknown):CourseLength {
  return value==='short'||value==='complete'||value==='custom' ? value : 'intermediate';
}

export function resolveCoursePageCount(lengthValue:unknown,customValue:unknown):number {
  const length=normalizeCourseLength(lengthValue);
  if(length==='short')return 4;
  if(length==='complete')return 12;
  if(length==='custom')return Math.min(24,Math.max(4,Math.round(Number(customValue)||8)));
  return 7;
}

export function normalizeCoursePages(value:unknown):CoursePage[] {
  if(!Array.isArray(value))return [];
  const usedIds=new Set<string>();
  return value.map((candidate,index):CoursePage=>{
    const page=candidate&&typeof candidate==='object'?candidate as Record<string,unknown>:{};
    const rawId=clean(page.id,80).replace(/[^A-Za-z0-9_-]+/g,'-')||`page-${index+1}`;
    const id=usedIds.has(rawId)?`${rawId}-${index+1}`:rawId; usedIds.add(id);
    const kind=COURSE_PAGE_KINDS.includes(page.kind as CoursePageKind)?page.kind as CoursePageKind:index===0?'cover':index===1?'introduction':'chapter';
    const sections=Array.isArray(page.sections)?page.sections.map((item)=>{
      const section=item&&typeof item==='object'?item as Record<string,unknown>:{};
      return {heading:clean(section.heading,300),body:clean(section.body,12_000)};
    }).filter((item)=>item.heading&&item.body).slice(0,8):[];
    const definitions=Array.isArray(page.definitions)?page.definitions.map((item)=>{
      const definition=item&&typeof item==='object'?item as Record<string,unknown>:{};
      return {term:clean(definition.term,200),definition:clean(definition.definition,2_000)};
    }).filter((item)=>item.term&&item.definition).slice(0,16):[];
    const examples=Array.isArray(page.examples)?page.examples.map((item)=>{
      const example=item&&typeof item==='object'?item as Record<string,unknown>:{};
      return {title:clean(example.title,240),description:clean(example.description,3_000)};
    }).filter((item)=>item.title&&item.description).slice(0,8):[];
    const practiceValue=page.practice&&typeof page.practice==='object'?page.practice as Record<string,unknown>:{};
    const sourceRefs=Array.isArray(page.sourceRefs)?page.sourceRefs.flatMap((item)=>{
      const ref=item&&typeof item==='object'?item as Record<string,unknown>:{}; const documentId=clean(ref.documentId,80); const pageNumber=Number(ref.pageNumber);
      return documentId&&Number.isInteger(pageNumber)&&pageNumber>0?[{documentId,pageNumber}]:[];
    }).filter((item,index,items)=>items.findIndex((other)=>other.documentId===item.documentId&&other.pageNumber===item.pageNumber)===index).slice(0,300):[];
    return {id,title:clean(page.title,300)||`Page ${index+1}`,kind,lead:clean(page.lead,3_000),sections,definitions,examples,keyPoints:list(page.keyPoints,20),practice:{title:clean(practiceValue.title,240),instructions:clean(practiceValue.instructions,3_000)},sourceRefs};
  });
}

export function coursePagesFromContent(content:unknown):CoursePage[] {
  if(!content||typeof content!=='object')return [];
  return normalizeCoursePages((content as Record<string,unknown>).coursePages);
}

export function coursePageTextLength(page:CoursePage):number {
  return [page.title,page.lead,...page.sections.flatMap((section)=>[section.heading,section.body]),...page.definitions.flatMap((definition)=>[definition.term,definition.definition]),...page.examples.flatMap((example)=>[example.title,example.description]),...page.keyPoints,page.practice.title,page.practice.instructions].join(' ').length;
}

function sourceKey(source:CoursePageSource):string {
  return `${source.documentId}:${source.pageNumber}`;
}

function sourceFromKey(key:string):CoursePageSource|null {
  const separator=key.lastIndexOf(':');
  if(separator<=0)return null;
  const documentId=key.slice(0,separator); const pageNumber=Number(key.slice(separator+1));
  return documentId&&Number.isInteger(pageNumber)&&pageNumber>0?{documentId,pageNumber}:null;
}

/**
 * Stabilise la structure renvoyée par l'IA avant le contrôle qualité.
 * Le schéma garantit le nombre de pages et leur contenu, mais un modèle peut
 * encore attribuer le bon contenu d'introduction à la mauvaise position ou
 * utiliser un mauvais libellé de page. Ce défaut de classement ne doit pas
 * annuler un cours complet déjà généré.
 */
export function stabilizeCoursePages(value:unknown,target:number,allowedPages:Set<string>):CoursePage[] {
  const pages=normalizeCoursePages(value);
  if(pages.length!==target||pages.length<3)return pages;

  const allIndexes=pages.map((_,index)=>index);
  const coverIndex=pages.findIndex((page)=>page.kind==='cover');
  const resolvedCoverIndex=coverIndex>=0?coverIndex:0;
  const introductionIndex=pages.findIndex((page,index)=>page.kind==='introduction'&&index!==resolvedCoverIndex);
  const resolvedIntroductionIndex=introductionIndex>=0?introductionIndex:(resolvedCoverIndex===1?0:1);
  let synthesisIndex=-1;
  for(let index=pages.length-1;index>=0;index--) {
    if(pages[index]?.kind==='synthesis'&&index!==resolvedCoverIndex&&index!==resolvedIntroductionIndex){synthesisIndex=index;break;}
  }
  if(synthesisIndex<0)synthesisIndex=allIndexes.findLast((index)=>index!==resolvedCoverIndex&&index!==resolvedIntroductionIndex)??pages.length-1;

  const middleIndexes=allIndexes
    .filter((index)=>index!==resolvedCoverIndex&&index!==resolvedIntroductionIndex&&index!==synthesisIndex)
    .sort((left,right)=>Number(pages[left]!.kind==='exercises')-Number(pages[right]!.kind==='exercises'));
  const orderedIndexes=[resolvedCoverIndex,resolvedIntroductionIndex,...middleIndexes,synthesisIndex];
  const ordered=orderedIndexes.map((index)=>({...pages[index]!,sourceRefs:[...pages[index]!.sourceRefs]}));

  ordered[0]={...ordered[0]!,kind:'cover'};
  ordered[1]={...ordered[1]!,kind:'introduction'};
  ordered[ordered.length-1]={...ordered[ordered.length-1]!,kind:'synthesis'};
  for(let index=2;index<ordered.length-1;index++) {
    if(ordered[index]!.kind==='cover'||ordered[index]!.kind==='introduction'||ordered[index]!.kind==='synthesis')ordered[index]={...ordered[index]!,kind:'chapter'};
  }

  const chapterMinimum=Math.max(1,target-4);
  let chapterCount=ordered.filter((page)=>page.kind==='chapter').length;
  for(let index=2;index<ordered.length-1&&chapterCount<chapterMinimum;index++) {
    if(ordered[index]!.kind==='exercises'){ordered[index]={...ordered[index]!,kind:'chapter'};chapterCount++;}
  }

  if(allowedPages.size) {
    for(let index=0;index<ordered.length;index++) {
      ordered[index]={...ordered[index]!,sourceRefs:ordered[index]!.sourceRefs.filter((source)=>allowedPages.has(sourceKey(source)))};
    }
    const cited=new Set(ordered.flatMap((page)=>page.sourceRefs.map(sourceKey)));
    const missing=[...allowedPages].filter((key)=>!cited.has(key)).map(sourceFromKey).filter((source):source is CoursePageSource=>source!==null);
    const recipientIndexes=ordered.map((page,index)=>({page,index})).filter(({page,index})=>index>0&&index<ordered.length-1&&page.kind==='chapter').map(({index})=>index);
    if(!recipientIndexes.length)recipientIndexes.push(1);
    missing.forEach((source,index)=>{
      const recipient=recipientIndexes[index%recipientIndexes.length]!;
      ordered[recipient]={...ordered[recipient]!,sourceRefs:[...ordered[recipient]!.sourceRefs,source]};
    });
  }

  return ordered;
}

export function validateCoursePages(pages:CoursePage[],target:number,lengthValue:unknown,allowedPages:Set<string>):string|null {
  if(pages.length!==target)return `le cours contient ${pages.length} page(s) au lieu des ${target} demandées.`;
  if(pages[0]?.kind!=='cover')return 'la première page doit être une couverture.';
  if(pages[1]?.kind!=='introduction')return 'la deuxième page doit être une introduction.';
  if(pages[pages.length-1]?.kind!=='synthesis')return 'la dernière page doit être une synthèse.';
  const chapterMinimum=Math.max(1,target-4);
  if(pages.filter((page)=>page.kind==='chapter').length<chapterMinimum)return `le cours doit contenir au moins ${chapterMinimum} chapitre(s).`;
  if(pages.filter((page)=>page.kind==='chapter').some((page)=>!page.sections.length))return 'chaque chapitre doit contenir des explications structurées.';
  const length=normalizeCourseLength(lengthValue); const perPage=length==='complete'?1_200:length==='intermediate'||length==='custom'?900:650;
  if(pages.reduce((sum,page)=>sum+coursePageTextLength(page),0)<target*perPage)return 'le contenu des pages est encore trop proche d’un résumé.';
  const cited=new Set(pages.flatMap((page)=>page.sourceRefs.map((ref)=>`${ref.documentId}:${ref.pageNumber}`)));
  for(const key of cited)if(allowedPages.size&&!allowedPages.has(key))return 'une page du cours cite une page source absente ou non sélectionnée.';
  for(const key of allowedPages)if(!cited.has(key))return 'le cours ne couvre pas encore toutes les pages exploitables du document.';
  return null;
}

export function coursePagesJsonSchema(pageCount:number) {
  const text={type:'string'} as const; const strings={type:'array',items:text} as const;
  return {type:'array',minItems:pageCount,maxItems:pageCount,items:{type:'object',additionalProperties:false,required:['id','title','kind','lead','sections','definitions','examples','keyPoints','practice','sourceRefs'],properties:{
    id:text,title:text,kind:{type:'string',enum:COURSE_PAGE_KINDS},lead:text,
    sections:{type:'array',items:{type:'object',additionalProperties:false,required:['heading','body'],properties:{heading:text,body:text}}},
    definitions:{type:'array',items:{type:'object',additionalProperties:false,required:['term','definition'],properties:{term:text,definition:text}}},
    examples:{type:'array',items:{type:'object',additionalProperties:false,required:['title','description'],properties:{title:text,description:text}}},
    keyPoints:strings,
    practice:{type:'object',additionalProperties:false,required:['title','instructions'],properties:{title:text,instructions:text}},
    sourceRefs:{type:'array',items:{type:'object',additionalProperties:false,required:['documentId','pageNumber'],properties:{documentId:text,pageNumber:{type:'integer',minimum:1}}}},
  }}} as const;
}
