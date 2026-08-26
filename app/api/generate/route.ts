import { env } from 'cloudflare:workers';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { activities, activityContents, encryptedApiCredentials, uploadedFiles } from '@/db/schema';
import { assertPermission, audit, requirePermission } from '@/lib/auth';
import { ACTIVITY_TYPES, ActivityDraft, ActivityType, validateActivityDraft } from '@/lib/activity-types';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { decryptSecret } from '@/lib/security';
import { buildGenerationPrompt, validateGeneratedExplanation } from '@/lib/generation-guidance';

type OpenAIResponse = { output?: unknown[]; error?: { code?: string; message?: string } };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requirePermission('useAi'); assertPermission(user, 'createActivities'); const body = await readJson(request); const prompt = String(body.prompt ?? '').trim();
    if (prompt.length < 15) throw new AppError(400, 'Décrivez plus précisément le cours ou l’activité souhaitée.', 'PROMPT_TOO_SHORT');
    const requested = Array.isArray(body.formats) ? body.formats.map(String) : [String(body.type ?? 'quiz')];
    const formats = [...new Set(requested)].filter((type): type is ActivityType => ACTIVITY_TYPES.some(([candidate]) => candidate === type)).slice(0, 6);
    if (!formats.length) throw new AppError(400, 'Choisissez au moins un format pédagogique.', 'NO_FORMAT');
    const credential = (await getDb().select().from(encryptedApiCredentials).where(eq(encryptedApiCredentials.trainerId, user.id)).limit(1))[0];
    if (!credential) throw new AppError(409, 'Connectez d’abord votre clé OpenAI personnelle dans Connexions.', 'OPENAI_NOT_CONNECTED');
    const apiKey = await decryptSecret(credential.ciphertext, credential.iv, env.MASTER_ENCRYPTION_KEY);
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(String).slice(0, 5) : [];
    const files = fileIds.length ? await getDb().select().from(uploadedFiles).where(and(eq(uploadedFiles.trainerId, user.id), inArray(uploadedFiles.id, fileIds))) : [];
    const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: buildGenerationPrompt(prompt, formats, body) }];
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.sizeBytes; if (totalBytes > 25 * 1024 * 1024) throw new AppError(413, 'L’ensemble des documents dépasse 25 Mo pour une analyse.', 'FILES_TOO_LARGE');
      const object = await env.FILES.get(file.objectKey); if (!object) throw new AppError(404, `Le fichier « ${file.originalName} » est introuvable.`, 'FILE_NOT_FOUND');
      const data = arrayBufferToBase64(await object.arrayBuffer()); const dataUrl = `data:${file.mimeType};base64,${data}`;
      content.push(file.mimeType.startsWith('image/') ? { type: 'input_image', image_url: dataUrl, detail: 'high' } : { type: 'input_file', filename: file.originalName, file_data: dataUrl });
    }
    const research = body.researchSources === true;
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: credential.model, store: false, instructions: 'Tu es un ingénieur pédagogique francophone expérimenté en formation professionnelle adulte. Produis un véritable mini-cours avant l’exercice, des consignes immédiatement applicables et des corrections qui enseignent. Appuie-toi prioritairement sur les documents joints. N’invente jamais de source ni de règle métier. Réponds strictement selon le schéma.', input: [{ role: 'user', content }], tools: research ? [{ type: 'web_search' }] : undefined, include: research ? ['web_search_call.action.sources'] : undefined, text: { format: { type: 'json_schema', name: 'progressed_pedago_bundle', strict: true, schema: bundleSchema(formats) } }, max_output_tokens: 16000 }),
    });
    const payload = await response.json() as OpenAIResponse;
    if (!response.ok) throw openAIError(response.status, payload.error?.code);
    const outputText = findOutputText(payload.output);
    if (!outputText) throw new AppError(502, 'OpenAI n’a renvoyé aucun contenu exploitable.', 'OPENAI_EMPTY_OUTPUT');
    let parsed: { activities: Array<Omit<ActivityDraft, 'content'> & { contentJson: string }> };
    try { parsed = JSON.parse(outputText) as typeof parsed; } catch { throw new AppError(502, 'La génération reçue est invalide. Relancez la demande.', 'OPENAI_INVALID_JSON'); }
    const citedUrls = collectCitedUrls(payload.output);
    const drafts = parsed.activities.map((item) => { let mechanic: Record<string, unknown>; try { mechanic = JSON.parse(item.contentJson) as Record<string, unknown>; } catch { throw new AppError(502, `La mécanique de « ${item.title} » est invalide.`, 'OPENAI_INVALID_MECHANIC'); } const sources = (item.sources ?? []).filter((source) => { try { const url = new URL(source.url); return url.protocol === 'https:' && (!research || citedUrls.has(source.url)); } catch { return false; } }); return { ...item, sources, content: mechanic } as ActivityDraft; });
    if (drafts.length !== formats.length) throw new AppError(502, 'La génération ne contient pas tous les formats demandés.', 'OPENAI_INCOMPLETE_BUNDLE');
    for (const draft of drafts) { const validation = validateActivityDraft(draft); if (!validation.valid) throw new AppError(502, `Contrôle qualité : ${validation.errors.join(' ')}`, 'OPENAI_QUALITY_REJECTED'); const explanationError = validateGeneratedExplanation(draft, body.explanationDepth); if (explanationError) throw new AppError(502, `Contrôle qualité : ${explanationError}`, 'OPENAI_EXPLANATION_TOO_SHORT'); }
    const now = Math.floor(Date.now() / 1000); const created = drafts.map((draft) => ({ id: crypto.randomUUID(), draft }));
    const statements = created.flatMap(({ id, draft }) => [getDb().insert(activities).values({ id, trainerId: user.id, type: draft.type, title: draft.title, theme: draft.theme, audience: draft.audience, level: draft.level, objectivesJson: JSON.stringify(draft.objectives), durationMinutes: draft.durationMinutes, instructions: draft.instructions, contentJson: JSON.stringify(draft.content), explanation: draft.explanation, correction: draft.correction, sourcesJson: JSON.stringify(draft.sources), status: 'draft', qualityScore: 90, createdAt: now, updatedAt: now }), getDb().insert(activityContents).values({ id: crypto.randomUUID(), activityId: id, version: 1, contentJson: JSON.stringify(draft), createdAt: now })]);
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    await audit(user.id, 'ai.bundle_generated', 'activity_bundle', null, { count: created.length, formats, fileCount: files.length, research }, request);
    return jsonOk({ activities: created.map(({ id, draft }) => ({ id, title: draft.title, type: draft.type })), message: `${created.length} création(s) contrôlée(s) et enregistrée(s) dans votre bibliothèque.` }, 201);
  } catch (error) { return jsonError(error); }
}

function bundleSchema(formats: ActivityType[]) { return { type: 'object', additionalProperties: false, required: ['activities'], properties: { activities: { type: 'array', minItems: formats.length, maxItems: formats.length, items: { type: 'object', additionalProperties: false, required: ['type', 'title', 'theme', 'audience', 'level', 'objectives', 'durationMinutes', 'instructions', 'explanation', 'correction', 'sources', 'contentJson'], properties: { type: { type: 'string', enum: formats }, title: { type: 'string' }, theme: { type: 'string' }, audience: { type: 'string' }, level: { type: 'string', enum: ['debutant', 'intermediaire', 'avance'] }, objectives: { type: 'array', minItems: 1, items: { type: 'string' } }, durationMinutes: { type: 'integer', minimum: 1, maximum: 480 }, instructions: { type: 'string' }, explanation: { type: 'string' }, correction: { type: 'string' }, sources: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'organization', 'url', 'usedFor'], properties: { title: { type: 'string' }, organization: { type: 'string' }, url: { type: 'string' }, usedFor: { type: 'string' } } } }, contentJson: { type: 'string' } } } } } }; }
function findOutputText(output: unknown): string { if (!Array.isArray(output)) return ''; for (const item of output) { if (!item || typeof item !== 'object') continue; const content = (item as { content?: unknown }).content; if (Array.isArray(content)) for (const part of content) if (part && typeof part === 'object' && (part as { type?: string }).type === 'output_text') return String((part as { text?: string }).text ?? ''); } return ''; }
function collectCitedUrls(output: unknown): Set<string> { const urls = new Set<string>(); const visit = (value: unknown) => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) return value.forEach(visit); for (const [key, nested] of Object.entries(value as Record<string, unknown>)) { if (key === 'url' && typeof nested === 'string') urls.add(nested); else visit(nested); } }; visit(output); return urls; }
function arrayBufferToBase64(buffer: ArrayBuffer): string { const bytes = new Uint8Array(buffer); let result = ''; for (let offset = 0; offset < bytes.length; offset += 8192) result += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(result); }
function openAIError(status: number, code?: string) { if (status === 401) return new AppError(400, 'La clé OpenAI enregistrée est invalide. Reconnectez-la dans Connexions.', 'OPENAI_INVALID_KEY'); if (status === 429 || code?.includes('quota')) return new AppError(429, 'Le quota OpenAI est dépassé ou la facturation est inactive.', 'OPENAI_QUOTA'); if (status === 403) return new AppError(403, 'Le modèle choisi n’est pas accessible avec cette clé OpenAI.', 'OPENAI_FORBIDDEN'); if (status >= 500) return new AppError(503, 'OpenAI est momentanément indisponible.', 'OPENAI_UNAVAILABLE'); return new AppError(502, 'La génération a été interrompue par OpenAI.', 'OPENAI_ERROR'); }
