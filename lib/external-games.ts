import { parseVimeoVideoId, parseYouTubeVideoId } from './source-ingestion.ts';

export type ExternalGameProvider = 'wordwall' | 'youtube' | 'vimeo' | 'genially' | 'learningapps' | 'canva' | 'document' | 'other';
export type ExternalGameScoreMode = 'manual_completion' | 'self_report';
export type ExternalResourceOutput = 'course' | 'summary' | 'memo' | 'explanations' | 'quiz' | 'true-false' | 'open-questions' | 'scenario' | 'case-study' | 'exercise' | 'correction' | 'pdf';

export type ExternalGameQuestion = { question: string; answer: string };
export type ExternalGamePaperOptions = {
  includeQr: boolean;
  includeExplanations: boolean;
  includeAnswers: boolean;
  includeCorrection: boolean;
  includeImages: boolean;
  learnerVersion: boolean;
  trainerVersion: boolean;
  questions: ExternalGameQuestion[];
  sourceDescription: string;
  screenshotUrl: string;
  officialFileId: string;
  officialFileName: string;
};

export type ExternalGameContent = {
  version: 2;
  provider: ExternalGameProvider;
  sourceUrl: string;
  embedUrl: string;
  htmlSourceName: string;
  presentationImageUrl: string;
  gameDescription: string;
  introduction: string;
  preGameExplanation: string;
  learnerTips: string[];
  debrief: string;
  summary: string;
  memo: string;
  supportText: string;
  supportFileIds: string[];
  selectedOutputs: ExternalResourceOutput[];
  scoreMode: ExternalGameScoreMode;
  scoreMax: number;
  paper: ExternalGamePaperOptions;
};

export const DEFAULT_EXTERNAL_GAME_CONTENT: ExternalGameContent = {
  version: 2,
  provider: 'wordwall',
  sourceUrl: '',
  embedUrl: '',
  htmlSourceName: '',
  presentationImageUrl: '',
  gameDescription: '',
  introduction: '',
  preGameExplanation: '',
  learnerTips: [],
  debrief: '',
  summary: '',
  memo: '',
  supportText: '',
  supportFileIds: [],
  selectedOutputs: ['course','summary','explanations','quiz','correction','pdf'],
  scoreMode: 'manual_completion',
  scoreMax: 100,
  paper: {
    includeQr: true,
    includeExplanations: true,
    includeAnswers: false,
    includeCorrection: false,
    includeImages: true,
    learnerVersion: true,
    trainerVersion: false,
    questions: [],
    sourceDescription: '',
    screenshotUrl: '',
    officialFileId: '',
    officialFileName: '',
  },
};

export function extractExternalGameUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return normalizeExternalGameUrl(value);
  if (!/^<iframe\b/i.test(value) || /<\s*script\b/i.test(value)) return null;
  const source = value.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
  return source ? normalizeExternalGameUrl(decodeHtmlUrl(source)) : null;
}

export type ExternalHtmlImport = {
  sourceUrl: string;
  embedUrl: string;
  provider: ExternalGameProvider;
  title: string;
  readableText: string;
};

export function inspectExternalHtml(input: string): ExternalHtmlImport | null {
  const html = input.replace(/\0/g, '').slice(0, 2_000_000);
  if (!html.trim()) return null;
  const inert = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, ' ');
  const iframeUrls = [...inert.matchAll(/<iframe\b[^>]*>/gi)].map((match) => htmlAttribute(match[0], 'src'));
  const metadataUrls = [...inert.matchAll(/<(?:meta|link)\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];
    const relation = `${htmlAttribute(tag, 'rel')} ${htmlAttribute(tag, 'property')} ${htmlAttribute(tag, 'name')}`.toLowerCase();
    return /canonical|og:url|twitter:url/.test(relation) ? [htmlAttribute(tag, 'href') || htmlAttribute(tag, 'content')] : [];
  });
  const linkedUrls = [...inert.matchAll(/<a\b[^>]*>/gi)].map((match) => htmlAttribute(match[0], 'href'));
  const normalizedIframes = iframeUrls.map((value) => normalizeExternalGameUrl(decodeHtmlUrl(value))).filter((value):value is string=>Boolean(value));
  const otherCandidates = [...metadataUrls, ...linkedUrls].map((value) => normalizeExternalGameUrl(decodeHtmlUrl(value))).filter((value): value is string => Boolean(value));
  const sourceUrl = normalizedIframes[0] ?? otherCandidates.find((value) => providerFromExternalGameUrl(value) !== 'other') ?? otherCandidates[0] ?? '';
  if (!sourceUrl) return null;
  const titleMatch = inert.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '';
  const title = decodeHtmlText(titleMatch.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 220);
  const readableText = decodeHtmlText(inert.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60_000);
  return { sourceUrl,embedUrl:externalResourceEmbedUrl(sourceUrl),provider:providerFromExternalGameUrl(sourceUrl),title,readableText };
}

export function normalizeExternalGameUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port && !['443'].includes(url.port)) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
    if (isPrivateHostname(hostname)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function providerFromExternalGameUrl(value: string): ExternalGameProvider {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname === 'wordwall.net' || hostname.endsWith('.wordwall.net')) return 'wordwall';
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be' || hostname.endsWith('.youtu.be') || hostname === 'youtube-nocookie.com' || hostname.endsWith('.youtube-nocookie.com')) return 'youtube';
    if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) return 'vimeo';
    if (hostname === 'genial.ly' || hostname.endsWith('.genial.ly') || hostname === 'genially.com' || hostname.endsWith('.genially.com')) return 'genially';
    if (hostname === 'learningapps.org' || hostname.endsWith('.learningapps.org')) return 'learningapps';
    if (hostname === 'canva.com' || hostname.endsWith('.canva.com')) return 'canva';
    if (/\.(pdf|docx?|pptx?|txt)$/i.test(new URL(value).pathname)) return 'document';
    return 'other';
  } catch {
    return 'other';
  }
}

export function providerLabel(provider: ExternalGameProvider): string {
  return ({wordwall:'Wordwall',youtube:'YouTube',vimeo:'Vimeo',genially:'Genially',learningapps:'LearningApps',canva:'Canva',document:'Document en ligne',other:'Application externe'} as Record<ExternalGameProvider,string>)[provider];
}

export function externalResourceEmbedUrl(value: string): string {
  const source = normalizeExternalGameUrl(value);
  if (!source) return '';
  const youtubeId = parseYouTubeVideoId(source);
  if (youtubeId) return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
  const vimeoId = parseVimeoVideoId(source);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  return source;
}

export function normalizeExternalGameContent(value: unknown): ExternalGameContent {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const paperSource = source.paper && typeof source.paper === 'object' ? source.paper as Record<string, unknown> : {};
  const sourceUrl = normalizeExternalGameUrl(text(source.sourceUrl)) ?? normalizeExternalGameUrl(text(source.embedUrl)) ?? '';
  const embedUrl = externalResourceEmbedUrl(normalizeExternalGameUrl(text(source.embedUrl)) ?? sourceUrl);
  const questions = Array.isArray(paperSource.questions) ? paperSource.questions.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const question = text(row.question); const answer = text(row.answer);
    return question ? [{ question, answer }] : [];
  }).slice(0, 40) : [];
  return {
    version: 2,
    provider: providerFromExternalGameUrl(sourceUrl || embedUrl),
    sourceUrl,
    embedUrl,
    htmlSourceName: text(source.htmlSourceName).slice(0,300),
    presentationImageUrl: normalizeExternalGameUrl(text(source.presentationImageUrl)) ?? '',
    gameDescription: text(source.gameDescription),
    introduction: text(source.introduction),
    preGameExplanation: text(source.preGameExplanation),
    learnerTips: Array.isArray(source.learnerTips) ? source.learnerTips.map(text).filter(Boolean).slice(0, 12) : [],
    debrief: text(source.debrief),
    summary: text(source.summary),
    memo: text(source.memo),
    supportText: text(source.supportText).slice(0,60_000),
    supportFileIds: Array.isArray(source.supportFileIds) ? source.supportFileIds.map(safeId).filter(Boolean).slice(0,6) : [],
    selectedOutputs: normalizeOutputs(source.selectedOutputs),
    scoreMode: source.scoreMode === 'self_report' ? 'self_report' : 'manual_completion',
    scoreMax: clampInteger(source.scoreMax, 1, 10_000, 100),
    paper: {
      includeQr: boolean(paperSource.includeQr, true),
      includeExplanations: boolean(paperSource.includeExplanations, true),
      includeAnswers: boolean(paperSource.includeAnswers, false),
      includeCorrection: boolean(paperSource.includeCorrection, false),
      includeImages: boolean(paperSource.includeImages, true),
      learnerVersion: boolean(paperSource.learnerVersion, true),
      trainerVersion: boolean(paperSource.trainerVersion, false),
      questions,
      sourceDescription: text(paperSource.sourceDescription),
      screenshotUrl: normalizeExternalGameUrl(text(paperSource.screenshotUrl)) ?? '',
      officialFileId: safeId(paperSource.officialFileId),
      officialFileName: text(paperSource.officialFileName).slice(0,300),
    },
  };
}

export function externalGameValidationErrors(value: unknown): string[] {
  const game = normalizeExternalGameContent(value);
  const errors: string[] = [];
  if (!game.sourceUrl || !game.embedUrl) errors.push('La ressource externe nécessite un lien HTTPS ou un code iframe valide.');
  if (!game.paper.learnerVersion && !game.paper.trainerVersion) errors.push('Choisissez au moins une version papier : apprenant ou formateur.');
  return errors;
}

function isPrivateHostname(hostname: string): boolean {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
  if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) return true;
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168;
}

function decodeHtmlUrl(value: string): string {
  return value.replace(/&amp;/gi, '&').replace(/&#x2f;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
}

function htmlAttribute(tag:string,name:string):string {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,'i'))?.[2];
  if (quoted !== undefined) return quoted;
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`,'i'))?.[1] ?? '';
}

function decodeHtmlText(value:string):string {
  return value
    .replace(/&#(\d+);/g,(_,code:string)=>decodeCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi,(_,code:string)=>decodeCodePoint(Number.parseInt(code,16)))
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

function decodeCodePoint(value:number):string { return Number.isInteger(value)&&value>=0&&value<=0x10ffff?String.fromCodePoint(value):''; }

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function boolean(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }
function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number { const number = Number(value); return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback; }
function safeId(value:unknown):string { const candidate=text(value);return /^[A-Za-z0-9_-]{8,100}$/.test(candidate)?candidate:''; }
function normalizeOutputs(value:unknown):ExternalResourceOutput[] {
  const allowed = new Set<ExternalResourceOutput>(['course','summary','memo','explanations','quiz','true-false','open-questions','scenario','case-study','exercise','correction','pdf']);
  const values = Array.isArray(value) ? value.map(text).filter((item):item is ExternalResourceOutput=>allowed.has(item as ExternalResourceOutput)) : [];
  return [...new Set(values.length ? values : DEFAULT_EXTERNAL_GAME_CONTENT.selectedOutputs)];
}
