export type ExternalGameProvider = 'wordwall' | 'other';
export type ExternalGameScoreMode = 'manual_completion' | 'self_report';

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
  version: 1;
  provider: ExternalGameProvider;
  embedUrl: string;
  presentationImageUrl: string;
  gameDescription: string;
  introduction: string;
  preGameExplanation: string;
  learnerTips: string[];
  debrief: string;
  scoreMode: ExternalGameScoreMode;
  scoreMax: number;
  paper: ExternalGamePaperOptions;
};

export const DEFAULT_EXTERNAL_GAME_CONTENT: ExternalGameContent = {
  version: 1,
  provider: 'wordwall',
  embedUrl: '',
  presentationImageUrl: '',
  gameDescription: '',
  introduction: '',
  preGameExplanation: '',
  learnerTips: [],
  debrief: '',
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
    return hostname === 'wordwall.net' || hostname.endsWith('.wordwall.net') ? 'wordwall' : 'other';
  } catch {
    return 'other';
  }
}

export function normalizeExternalGameContent(value: unknown): ExternalGameContent {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const paperSource = source.paper && typeof source.paper === 'object' ? source.paper as Record<string, unknown> : {};
  const embedUrl = normalizeExternalGameUrl(text(source.embedUrl)) ?? '';
  const questions = Array.isArray(paperSource.questions) ? paperSource.questions.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const question = text(row.question); const answer = text(row.answer);
    return question ? [{ question, answer }] : [];
  }).slice(0, 40) : [];
  return {
    version: 1,
    provider: source.provider === 'wordwall' || providerFromExternalGameUrl(embedUrl) === 'wordwall' ? 'wordwall' : 'other',
    embedUrl,
    presentationImageUrl: normalizeExternalGameUrl(text(source.presentationImageUrl)) ?? '',
    gameDescription: text(source.gameDescription),
    introduction: text(source.introduction),
    preGameExplanation: text(source.preGameExplanation),
    learnerTips: Array.isArray(source.learnerTips) ? source.learnerTips.map(text).filter(Boolean).slice(0, 12) : [],
    debrief: text(source.debrief),
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
  if (!game.embedUrl) errors.push('Le jeu externe nécessite un lien HTTPS ou un code iframe valide.');
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

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function boolean(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }
function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number { const number = Number(value); return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback; }
function safeId(value:unknown):string { const candidate=text(value);return /^[A-Za-z0-9_-]{8,100}$/.test(candidate)?candidate:''; }
