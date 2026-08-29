export const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'image/png',
  'image/jpeg',
]);

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export type ReadingQuality = 'good' | 'partial' | 'illegible';
export type DocumentPageAnalysis = {
  pageNumber: number;
  title: string;
  summary: string;
  rawText: string;
  notions: string[];
  procedures: string[];
  risks: string[];
  rules: string[];
  examples: string[];
  audiences: string[];
  objectives: string[];
  level: 'debutant' | 'intermediaire' | 'avance';
  readingQuality: ReadingQuality;
  warnings: string[];
};

export type DocumentAnalysis = {
  pageCount: number;
  detectedTheme: string;
  summary: string;
  keywords: string[];
  pages: DocumentPageAnalysis[];
};

export type ScenarioBrief = {
  title: string;
  theme: string;
  subtheme: string;
  audience: string;
  profession: string;
  level: 'debutant' | 'intermediaire' | 'avance';
  prerequisites: string[];
  durationMinutes: number;
  objectives: string[];
  competencies: string[];
  vocabulary: string[];
  professionalContext: string;
  learnerRole: string;
  learningGoal: string;
  constraints: string[];
  risks: string[];
  keyProcedures: string[];
  successCriteria: string[];
  recommendedSceneCount: number;
  recommendedDifficulty: 'simple' | 'progressive' | 'complexe';
};

export type KnowledgePageRow = {
  fileId: string;
  originalName: string;
  pageNumber: number;
  title: string;
  summary: string;
  notionsJson: string;
  proceduresJson: string;
  risksJson: string;
  rulesJson: string;
  examplesJson: string;
  audiencesJson: string;
  objectivesJson: string;
  level: string;
  readingQuality: string;
  warningsJson: string;
  excludedInformationJson: string;
  trainerNotes: string;
};

const asText = (value: unknown, maximum = 4_000) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const asList = (value: unknown, maximum = 30) => Array.isArray(value)
  ? [...new Set(value.map((item) => asText(item, 500)).filter(Boolean))].slice(0, maximum)
  : [];

export function safeDocumentName(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f/\\]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 200) || 'document';
}

export function safeObjectName(value: string): string {
  return safeDocumentName(value).replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120) || 'document';
}

export function hasValidDocumentSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'application/pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType.includes('openxmlformats') || mimeType === 'application/vnd.ms-powerpoint') return startsWith(bytes, [0x50, 0x4b]);
  if (mimeType === 'text/plain') {
    if (!bytes.length) return false;
    const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
    let suspicious = 0;
    for (const byte of sample) if (byte === 0 || (byte < 9 || (byte > 13 && byte < 32))) suspicious += 1;
    return suspicious / sample.length < 0.02;
  }
  return false;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

export function normalizeDocumentAnalysis(value: unknown): DocumentAnalysis {
  if (!value || typeof value !== 'object') throw new Error('Analyse documentaire vide.');
  const candidate = value as Record<string, unknown>;
  const rawPages = Array.isArray(candidate.pages) ? candidate.pages : [];
  const pages = rawPages.map((page, index): DocumentPageAnalysis => {
    const row = page && typeof page === 'object' ? page as Record<string, unknown> : {};
    const pageNumber = Number(row.pageNumber);
    const level = row.level === 'avance' || row.level === 'intermediaire' ? row.level : 'debutant';
    const readingQuality = row.readingQuality === 'partial' || row.readingQuality === 'illegible' ? row.readingQuality : 'good';
    return {
      pageNumber: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : index + 1,
      title: asText(row.title, 300),
      summary: asText(row.summary, 2_000),
      rawText: asText(row.rawText, 12_000),
      notions: asList(row.notions), procedures: asList(row.procedures), risks: asList(row.risks), rules: asList(row.rules),
      examples: asList(row.examples), audiences: asList(row.audiences), objectives: asList(row.objectives), level, readingQuality,
      warnings: asList(row.warnings),
    };
  }).sort((left, right) => left.pageNumber - right.pageNumber);
  if (!pages.length) throw new Error('Aucune page exploitable n’a été détectée.');
  return {
    pageCount: Math.max(Number(candidate.pageCount) || 0, ...pages.map((page) => page.pageNumber)),
    detectedTheme: asText(candidate.detectedTheme, 300) || pages[0].title || 'Document pédagogique',
    summary: asText(candidate.summary, 4_000) || pages.map((page) => page.summary).filter(Boolean).slice(0, 3).join(' '),
    keywords: asList(candidate.keywords), pages,
  };
}

export function parseJsonList(value: string): string[] {
  try { return asList(JSON.parse(value)); } catch { return []; }
}

export function buildKnowledgeContext(pages: KnowledgePageRow[]): string {
  if (!pages.length) return '';
  return pages.map((page) => {
    const blocks = [
      page.summary && `Résumé : ${page.summary}`,
      listLine('Notions', page.notionsJson), listLine('Procédures', page.proceduresJson), listLine('Risques', page.risksJson),
      listLine('Règles', page.rulesJson), listLine('Exemples', page.examplesJson), listLine('Objectifs', page.objectivesJson),
      page.trainerNotes && `Notes du formateur : ${page.trainerNotes}`,
      parseJsonList(page.excludedInformationJson).length && `Informations explicitement exclues par le formateur — NE PAS UTILISER : ${parseJsonList(page.excludedInformationJson).join(' ; ')}`,
      page.readingQuality !== 'good' && `Avertissement de lecture : ${page.readingQuality}. Ne jamais inventer le texte illisible.`,
    ].filter(Boolean);
    return `SOURCE [document:${page.fileId}|page:${page.pageNumber}] — ${page.originalName}${page.title ? ` — ${page.title}` : ''}\n${blocks.join('\n')}`;
  }).join('\n\n');
}

export function rankKnowledgePages(pages: KnowledgePageRow[], query: string, maximum = 40): KnowledgePageRow[] {
  if (pages.length <= maximum) return pages;
  const terms = tokenize(query);
  if (!terms.length) return pages.slice(0, maximum);
  return pages.map((page,index) => {
    const searchable = `${page.title} ${page.summary} ${page.notionsJson} ${page.proceduresJson} ${page.risksJson} ${page.rulesJson} ${page.objectivesJson} ${page.trainerNotes}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
    const title = page.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
    const score = terms.reduce((total,term) => total + (title.includes(term) ? 5 : 0) + countOccurrences(searchable,term),0);
    return { page,index,score };
  }).sort((left,right) => right.score - left.score || left.index - right.index).slice(0,maximum).sort((left,right) => left.index - right.index).map((entry) => entry.page);
}

function tokenize(value: string): string[] {
  return [...new Set(value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').split(/[^a-z0-9]+/).filter((term) => term.length >= 4))].slice(0,80);
}

function countOccurrences(value: string, term: string): number {
  let count = 0; let start = 0;
  while ((start = value.indexOf(term,start)) >= 0) { count += 1; start += term.length; }
  return Math.min(count,5);
}

function listLine(label: string, json: string): string {
  const values = parseJsonList(json);
  return values.length ? `${label} : ${values.join(' ; ')}` : '';
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer); let result = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) result += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(result);
}

export function findOpenAIOutputText(output: unknown): string {
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) if (part && typeof part === 'object' && (part as { type?: string }).type === 'output_text') return String((part as { text?: string }).text ?? '');
  }
  return '';
}

export const documentAnalysisSchema = {
  type: 'object', additionalProperties: false,
  required: ['pageCount', 'detectedTheme', 'summary', 'keywords', 'pages'],
  properties: {
    pageCount: { type: 'integer', minimum: 1 }, detectedTheme: { type: 'string' }, summary: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } },
    pages: { type: 'array', minItems: 1, items: {
      type: 'object', additionalProperties: false,
      required: ['pageNumber','title','summary','rawText','notions','procedures','risks','rules','examples','audiences','objectives','level','readingQuality','warnings'],
      properties: {
        pageNumber: { type: 'integer', minimum: 1 }, title: { type: 'string' }, summary: { type: 'string' }, rawText: { type: 'string' },
        notions: stringArraySchema(), procedures: stringArraySchema(), risks: stringArraySchema(), rules: stringArraySchema(), examples: stringArraySchema(), audiences: stringArraySchema(), objectives: stringArraySchema(),
        level: { type: 'string', enum: ['debutant','intermediaire','avance'] }, readingQuality: { type: 'string', enum: ['good','partial','illegible'] }, warnings: stringArraySchema(),
      },
    } },
  },
} as const;

export const scenarioBriefSchema = {
  type: 'object', additionalProperties: false,
  required: ['title','theme','subtheme','audience','profession','level','prerequisites','durationMinutes','objectives','competencies','vocabulary','professionalContext','learnerRole','learningGoal','constraints','risks','keyProcedures','successCriteria','recommendedSceneCount','recommendedDifficulty'],
  properties: {
    title: { type:'string' }, theme: { type:'string' }, subtheme: { type:'string' }, audience: { type:'string' }, profession: { type:'string' }, level: { type:'string', enum:['debutant','intermediaire','avance'] },
    prerequisites: stringArraySchema(), durationMinutes: { type:'integer', minimum:5, maximum:480 }, objectives: stringArraySchema(), competencies: stringArraySchema(), vocabulary: stringArraySchema(), professionalContext: { type:'string' }, learnerRole: { type:'string' }, learningGoal: { type:'string' }, constraints: stringArraySchema(), risks: stringArraySchema(), keyProcedures: stringArraySchema(), successCriteria: stringArraySchema(), recommendedSceneCount: { type:'integer', minimum:1, maximum:6 }, recommendedDifficulty: { type:'string', enum:['simple','progressive','complexe'] },
  },
} as const;

function stringArraySchema() { return { type: 'array', items: { type: 'string' } } as const; }
