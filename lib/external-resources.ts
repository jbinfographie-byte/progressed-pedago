import { AppError } from '@/lib/app-error';
import { parseVimeoVideoId, parseYouTubeVideoId } from '@/lib/source-ingestion';

export const RESOURCE_PROVIDERS = ['canva','microsoft','google','youtube','genially','padlet','miro','kahoot','learningapps','vimeo','other'] as const;
export type ResourceProvider = typeof RESOURCE_PROVIDERS[number];
export type ResourceType = 'link' | 'video' | 'presentation' | 'document' | 'embed' | 'download';
export type ResourcePlacement = 'before' | 'after' | 'course' | 'instructions' | 'help';
export type ResourceOpenMode = 'site' | 'new_tab' | 'download';

const providerHosts: Array<[ResourceProvider, RegExp]> = [
  ['canva', /(^|\.)canva\.com$/], ['microsoft', /(^|\.)(office\.com|officeapps\.live\.com|live\.com|sharepoint\.com|1drv\.ms)$/],
  ['google', /(^|\.)(google\.com|googleusercontent\.com)$/], ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/], ['genially', /(^|\.)genial\.ly$/],
  ['padlet', /(^|\.)padlet\.com$/], ['miro', /(^|\.)miro\.com$/], ['kahoot', /(^|\.)kahoot\.it$|(^|\.)kahoot\.com$/],
  ['learningapps', /(^|\.)learningapps\.org$/], ['vimeo', /(^|\.)vimeo\.com$/],
];

export function normalizeExternalResource(input: Record<string, unknown>) {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!name) throw new AppError(400, 'Le nom de la ressource est obligatoire.', 'RESOURCE_NAME_REQUIRED');
  const url = safeResourceUrl(String(input.url ?? ''));
  const detectedProvider = providerHosts.find(([, pattern]) => pattern.test(url.hostname.toLowerCase()))?.[0] ?? 'other';
  const requestedProvider = String(input.provider ?? '').toLowerCase() as ResourceProvider;
  const provider = RESOURCE_PROVIDERS.includes(requestedProvider) ? requestedProvider : detectedProvider;
  const requestedType = String(input.resourceType ?? 'link') as ResourceType;
  const resourceType: ResourceType = ['link','video','presentation','document','embed','download'].includes(requestedType) ? requestedType : 'link';
  const requestedPlacement = String(input.placement ?? 'course') as ResourcePlacement;
  const placement: ResourcePlacement = ['before','after','course','instructions','help'].includes(requestedPlacement) ? requestedPlacement : 'course';
  const requestedOpenMode = String(input.openMode ?? 'new_tab') as ResourceOpenMode;
  let openMode: ResourceOpenMode = ['site','new_tab','download'].includes(requestedOpenMode) ? requestedOpenMode : 'new_tab';
  const embedUrl = approvedEmbedUrl(provider, url);
  if (openMode === 'site' && !embedUrl) openMode = 'new_tab';
  return {
    name, url: url.toString(), provider, category: providerLabel(provider), resourceType, placement, openMode, embedUrl,
    required: input.required === true, trainingId: cleanId(input.trainingId), activityId: cleanId(input.activityId),
    thumbnailUrl: optionalHttpsUrl(input.thumbnailUrl), externalId: String(input.externalId ?? '').trim().slice(0, 240) || null,
    metadataJson: JSON.stringify(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
  };
}

export function providerLabel(provider: ResourceProvider): string {
  return ({canva:'Canva',microsoft:'Microsoft 365',google:'Google Drive',youtube:'YouTube',genially:'Genially',padlet:'Padlet',miro:'Miro',kahoot:'Kahoot',learningapps:'LearningApps',vimeo:'Vimeo',other:'Autre'} as Record<ResourceProvider,string>)[provider];
}

function safeResourceUrl(input: string): URL {
  let url: URL; try { url = new URL(input.trim()); } catch { throw new AppError(400, 'Saisissez une adresse web valide.', 'INVALID_RESOURCE_URL'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new AppError(400, 'Seules les adresses HTTPS publiques sont acceptées.', 'UNSAFE_RESOURCE_URL');
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '0.0.0.0' || hostname === '::1' || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) throw new AppError(400, 'Cette adresse privée ou locale ne peut pas être intégrée.', 'PRIVATE_RESOURCE_URL');
  url.hash = ''; return url;
}

function approvedEmbedUrl(provider: ResourceProvider, url: URL): string | null {
  if (provider === 'youtube') { const id = parseYouTubeVideoId(url.toString()); return id ? `https://www.youtube-nocookie.com/embed/${id}` : null; }
  if (provider === 'vimeo') { const id = parseVimeoVideoId(url.toString()); return id ? `https://player.vimeo.com/video/${id}` : null; }
  if (provider === 'genially' && url.hostname.toLowerCase().endsWith('genial.ly')) return url.toString();
  if (provider === 'learningapps' && url.hostname.toLowerCase().endsWith('learningapps.org')) return url.toString();
  if (provider === 'canva' && url.searchParams.has('embed')) return url.toString();
  return null;
}

function cleanId(value: unknown): string | null { const id = String(value ?? '').trim(); return id && id.length <= 100 ? id : null; }
function optionalHttpsUrl(value: unknown): string | null { const input = String(value ?? '').trim(); if (!input) return null; try { const url = new URL(input); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null; } catch { return null; } }
