import type { ActivityType } from '@/lib/activity-types';

export const COURSE_IMAGE_PLACEMENTS = ['cover','introduction','explanation','example','procedure','scenario','synthesis','exercise'] as const;
export const COURSE_IMAGE_STYLES = ['automatic','realistic','illustration','pedagogical'] as const;
export const COURSE_IMAGE_WIDTHS = ['small','medium','large','full'] as const;
export const COURSE_IMAGE_SOURCES = ['upload','ai','document'] as const;

export type CourseImagePlacement = typeof COURSE_IMAGE_PLACEMENTS[number];
export type CourseImageStyle = typeof COURSE_IMAGE_STYLES[number];
export type CourseImageWidth = typeof COURSE_IMAGE_WIDTHS[number];
export type CourseImageSource = typeof COURSE_IMAGE_SOURCES[number];

export type CourseImage = {
  id: string;
  url: string;
  objectKey: string;
  mimeType: 'image/png' | 'image/jpeg';
  source: CourseImageSource;
  placement: CourseImagePlacement;
  style: CourseImageStyle;
  prompt: string;
  altText: string;
  caption: string;
  status: 'draft' | 'validated';
  width: CourseImageWidth;
  fit: 'contain' | 'cover';
  focalX: number;
  focalY: number;
  position: number;
  sourceFileId?: string;
  sourcePage?: number;
  pageId?: string;
  rightsConfirmed?: boolean;
  createdAt: number;
  updatedAt: number;
};

export const COURSE_IMAGE_PLACEMENT_LABELS: Record<CourseImagePlacement,string> = {
  cover:'Couverture', introduction:'Introduction', explanation:'Explication importante', example:'Exemple', procedure:'Procédure', scenario:'Mise en situation', synthesis:'Synthèse', exercise:'Exercice ou quiz',
};
export const COURSE_IMAGE_STYLE_LABELS: Record<CourseImageStyle,string> = {
  automatic:'Automatique', realistic:'Réaliste', illustration:'Illustration', pedagogical:'Dessin pédagogique',
};

const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] => typeof value === 'string' && values.includes(value as T[number]);
const cleanText = (value: unknown, max: number) => String(value ?? '').trim().slice(0,max);
const clamp = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum,Math.max(minimum,number)) : fallback;
};

export function normalizeCourseImages(value: unknown): CourseImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate,index) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const image = candidate as Record<string,unknown>;
    const id = cleanText(image.id,80); const objectKey = cleanText(image.objectKey,600);
    if (!id || !objectKey) return [];
    const source = isOneOf(image.source,COURSE_IMAGE_SOURCES) ? image.source : 'upload';
    const placement = isOneOf(image.placement,COURSE_IMAGE_PLACEMENTS) ? image.placement : 'explanation';
    const style = isOneOf(image.style,COURSE_IMAGE_STYLES) ? image.style : 'automatic';
    const width = isOneOf(image.width,COURSE_IMAGE_WIDTHS) ? image.width : 'large';
    const mimeType = image.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const createdAt = Math.round(clamp(image.createdAt,0,9_999_999_999,Math.floor(Date.now()/1000)));
    const sourcePage = Number(image.sourcePage);
    return [{
      id, objectKey, url:cleanText(image.url,700) || '', mimeType, source, placement, style,
      prompt:cleanText(image.prompt,3_000), altText:cleanText(image.altText,300) || 'Illustration pédagogique', caption:cleanText(image.caption,500),
      status:image.status === 'validated' ? 'validated' : 'draft', width, fit:image.fit === 'cover' ? 'cover' : 'contain',
      focalX:clamp(image.focalX,0,100,50), focalY:clamp(image.focalY,0,100,50), position:Math.round(clamp(image.position,0,1_000,index)),
      sourceFileId:cleanText(image.sourceFileId,80) || undefined,
      sourcePage:Number.isInteger(sourcePage) && sourcePage > 0 ? Math.min(20_000,sourcePage) : undefined,
      pageId:cleanText(image.pageId,80) || undefined,
      rightsConfirmed:image.rightsConfirmed === true, createdAt, updatedAt:Math.round(clamp(image.updatedAt,0,9_999_999_999,createdAt)),
    } satisfies CourseImage];
  }).sort((left,right) => left.position - right.position);
}

export function courseImagesFromContent(content: unknown): CourseImage[] {
  if (!content || typeof content !== 'object') return [];
  return normalizeCourseImages((content as Record<string,unknown>).courseImages);
}

export function withCourseImages(content: unknown, images: CourseImage[]): Record<string,unknown> {
  const base = content && typeof content === 'object' && !Array.isArray(content) ? content as Record<string,unknown> : {};
  return {...base,courseImages:images.map((image,index) => ({...image,position:index}))};
}

export function resolveAutomaticPlacement(type: ActivityType, index = 0): CourseImagePlacement {
  if (index === 0) return 'cover';
  if (type === 'scenario') return 'scenario';
  if (type === 'drag-drop') return 'procedure';
  if (type === 'quiz' || type === 'true-false') return 'explanation';
  return index % 2 === 0 ? 'example' : 'explanation';
}

export function buildCourseImagePrompt(input: {title:string;theme?:string;audience?:string;objectives?:string[];placement:CourseImagePlacement;style:CourseImageStyle;prompt?:string;inspiredByDocument?:boolean;directDocumentUse?:boolean}) {
  const style = input.style === 'realistic' ? 'photographie réaliste et professionnelle' : input.style === 'illustration' ? 'illustration éditoriale claire et moderne' : input.style === 'pedagogical' ? 'dessin pédagogique simple, lisible et annotable' : 'style visuel automatiquement adapté au sujet et au public';
  const rightsInstruction = input.inspiredByDocument
    ? 'Transmets la même idée pédagogique que le document de référence avec une composition, des personnages, un cadrage et un graphisme entièrement originaux. Ne copie ni la mise en page, ni les textes, ni les éléments distinctifs du visuel source.'
    : input.directDocumentUse
      ? 'Le formateur confirme disposer des droits. Isole le visuel pédagogique pertinent, conserve fidèlement son sens et adapte seulement son cadrage au format demandé.'
      : '';
  return [
    `Crée une image de cours en format paysage 3:2 pour l’emplacement « ${COURSE_IMAGE_PLACEMENT_LABELS[input.placement]} ».`,
    `Sujet : ${cleanText(input.title,300)}. Thème : ${cleanText(input.theme,300) || 'formation professionnelle'}.`,
    `Public : ${cleanText(input.audience,300) || 'adultes en formation'}. Objectifs : ${(input.objectives ?? []).map((item) => cleanText(item,300)).filter(Boolean).slice(0,5).join(' ; ') || 'comprendre et appliquer la notion'}.`,
    `Style : ${style}. L’image doit être précise, inclusive, professionnelle, immédiatement compréhensible et sans logo. Évite tout texte dans l’image, les filigranes et les décorations inutiles.`,
    cleanText(input.prompt,2_000), rightsInstruction,
  ].filter(Boolean).join('\n');
}

export function imageUrl(activityId:string,imageId:string):string {
  return `/api/course-images/${encodeURIComponent(activityId)}/${encodeURIComponent(imageId)}`;
}
