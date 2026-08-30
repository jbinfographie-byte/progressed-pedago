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
  if(length==='custom')return Math.min(24,Math.max(3,Math.round(Number(customValue)||8)));
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
