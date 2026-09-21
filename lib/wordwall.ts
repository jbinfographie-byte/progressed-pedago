import { AppError } from './http.ts';
import { isWordwallEmbedUrl, normalizeExternalGameUrl, providerFromExternalGameUrl, wordwallEmbedFromOEmbedHtml } from './external-games.ts';

export type WordwallEmbed={sourceUrl:string;embedUrl:string;title:string;thumbnailUrl:string};

export async function resolveWordwallEmbed(value:string):Promise<WordwallEmbed> {
  const sourceUrl=normalizeExternalGameUrl(value);
  if(!sourceUrl||providerFromExternalGameUrl(sourceUrl)!=='wordwall')throw new AppError(400,'Ajoutez un lien public Wordwall valide.','WORDWALL_URL_REQUIRED');
  if(isWordwallEmbedUrl(sourceUrl))return {sourceUrl,embedUrl:sourceUrl,title:'',thumbnailUrl:''};
  const endpoint=new URL('https://wordwall.net/api/oembed');endpoint.searchParams.set('url',sourceUrl);endpoint.searchParams.set('format','json');
  const response=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12_000)});
  const payload=await response.json().catch(()=>null) as {html?:unknown;title?:unknown;thumbnail_url?:unknown}|null;
  if(!response.ok||!payload)throw new AppError(422,'Wordwall n’a pas fourni de lecteur pour cette activité. Vérifiez que le lien est public ou collez son code iframe d’intégration.','WORDWALL_OEMBED_UNAVAILABLE');
  const embedUrl=wordwallEmbedFromOEmbedHtml(typeof payload.html==='string'?payload.html:'');
  if(!embedUrl)throw new AppError(422,'Le lien Wordwall ne contient pas de lecteur intégrable. Dans Wordwall, rendez l’activité publique puis copiez son lien ou son code iframe.','WORDWALL_EMBED_UNAVAILABLE');
  return {sourceUrl,embedUrl,title:typeof payload.title==='string'?payload.title.trim().slice(0,220):'',thumbnailUrl:normalizeExternalGameUrl(typeof payload.thumbnail_url==='string'?payload.thumbnail_url:'')??''};
}
