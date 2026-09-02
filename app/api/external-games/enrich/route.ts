import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { encryptedApiCredentials } from '@/db/schema';
import { assertPermission, requirePermission } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { decryptSecret } from '@/lib/security';
import { extractExternalGameUrl } from '@/lib/external-games';

type Enrichment = {
  introduction: string;
  preGameExplanation: string;
  learnerTips: string[];
  debrief: string;
  correction: string;
  questions: Array<{ question: string; answer: string }>;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requirePermission('useAi'); assertPermission(user, 'createActivities');
    const body = await readJson(request);
    const embedUrl = extractExternalGameUrl(String(body.embedUrl ?? ''));
    const description = String(body.description ?? '').trim();
    if (!embedUrl) throw new AppError(400, 'Ajoutez d’abord un lien HTTPS ou un code iframe valide.', 'EXTERNAL_GAME_URL_REQUIRED');
    if (description.length < 20) throw new AppError(400, 'Décrivez le contenu du jeu en quelques phrases pour permettre une génération fiable.', 'EXTERNAL_GAME_DESCRIPTION_REQUIRED');
    const credential = (await getDb().select().from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, user.id)).limit(1))[0];
    if (!credential) throw new AppError(409, 'Connectez d’abord votre clé OpenAI personnelle dans Connexions.', 'OPENAI_NOT_CONNECTED');
    const apiKey = await decryptSecret(credential.ciphertext, credential.iv, env.MASTER_ENCRYPTION_KEY);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: credential.model,
        store: false,
        instructions: 'Tu es ingénieur pédagogique francophone. Le lien externe est une référence non exécutable : ne prétends jamais l’avoir consulté. Appuie-toi uniquement sur la description fournie. Rédige des contenus concrets, adaptés à la formation professionnelle adulte, sans inventer de score ni de fonctionnalité du site externe.',
        input: `Prépare l’accompagnement pédagogique d’un jeu externe.\nAdresse : ${embedUrl}\nDescription fournie par le formateur :\n${description}`,
        text: { format: { type: 'json_schema', name: 'external_game_pedagogy', strict: true, schema: enrichmentSchema } },
        max_output_tokens: 3_500,
      }),
    });
    const payload = await response.json() as { output?: unknown[]; error?: { code?: string } };
    if (!response.ok) throw openAIError(response.status,payload.error?.code);
    const output = findOutputText(payload.output);
    if (!output) throw new AppError(502, 'L’IA n’a renvoyé aucun contenu exploitable.', 'OPENAI_EMPTY_OUTPUT');
    let enrichment: Enrichment;
    try { enrichment = JSON.parse(output) as Enrichment; } catch { throw new AppError(502, 'La réponse reçue est invalide. Relancez la génération.', 'OPENAI_INVALID_JSON'); }
    return jsonOk({ enrichment });
  } catch (error) { return jsonError(error); }
}

const enrichmentSchema = {
  type: 'object', additionalProperties: false,
  required: ['introduction','preGameExplanation','learnerTips','debrief','correction','questions'],
  properties: {
    introduction: { type:'string' }, preGameExplanation:{type:'string'}, learnerTips:{type:'array',minItems:3,maxItems:8,items:{type:'string'}}, debrief:{type:'string'}, correction:{type:'string'},
    questions:{type:'array',minItems:3,maxItems:12,items:{type:'object',additionalProperties:false,required:['question','answer'],properties:{question:{type:'string'},answer:{type:'string'}}}},
  },
};

function findOutputText(output: unknown): string {
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (Array.isArray(content)) for (const part of content) if (part && typeof part === 'object' && (part as {type?:string}).type === 'output_text') return String((part as {text?:unknown}).text ?? '');
  }
  return '';
}

function openAIError(status:number,code?:string) {
  if (status === 401) return new AppError(400,'La clé OpenAI enregistrée est invalide. Reconnectez-la dans Connexions.','OPENAI_INVALID_KEY');
  if (status === 429 || code?.includes('quota')) return new AppError(429,'Le quota OpenAI est dépassé ou la facturation est inactive.','OPENAI_QUOTA');
  if (status === 403) return new AppError(403,'Le modèle choisi n’est pas accessible avec cette clé OpenAI.','OPENAI_FORBIDDEN');
  return new AppError(status >= 500 ? 503 : 502,'La génération pédagogique a été interrompue.','OPENAI_ERROR');
}
