import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.1";

const OPENAI_API_URL = "https://api.openai.com/v1";
const REALTIME_MODEL = "gpt-realtime";
const GENERATION_MODEL = "gpt-5.2";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://9ffd298c-745e-4787-8a85-26deae9a187c.app-preview.com",
  "https://progressed-pedago.boisfer-jacky.chatgpt.site",
  "https://pedago.progressed.fr",
];

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin ?? DEFAULT_ALLOWED_ORIGINS[0],
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
}

function allowedOrigin(requestOrigin: string | null) {
  if (!requestOrigin) return null;
  const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
  return allowed.has(requestOrigin.replace(/\/$/, "")) ? requestOrigin : undefined;
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberInRange(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function buildTutorInstructions(body: JsonRecord) {
  const subject = text(body.subject, 300) || "le sujet fourni par le formateur";
  const objectives = text(body.objectives, 2_000);
  const courseText = text(body.courseText, 14_000);
  const roleplay = text(body.roleplay, 2_000);
  const language = text(body.language, 80) || "français";
  const learnerLevel = text(body.learnerLevel, 120) || "adapté au niveau de l'apprenant";

  return [
    "Tu es le coach vocal interactif de Progressed Pédago.",
    `Tu enseignes en ${language}, sur le thème : ${subject}.`,
    `Niveau : ${learnerLevel}.`,
    objectives ? `Objectifs : ${objectives}.` : "",
    courseText ? `Base-toi prioritairement sur ce contenu du formateur :\n${courseText}` : "",
    roleplay ? `Mise en situation : ${roleplay}` : "",
    "Conduis un vrai dialogue oral : pose une seule question à la fois, attends la réponse, puis indique clairement si elle est correcte, partiellement correcte ou à reprendre.",
    "Explique brièvement la correction, fais reformuler ou répéter lorsque c'est utile, puis passe à la question suivante.",
    "Pour une langue, corrige avec bienveillance le vocabulaire, la grammaire et la prononciation. Pour une thématique professionnelle, vérifie les gestes, les priorités, la sécurité et le raisonnement.",
    "Si une mise en situation est demandée, incarne le rôle indiqué (agent, chef d'équipe, client ou autre) sans sortir du cadre pédagogique.",
    "N'invente pas qu'une réponse est correcte. En cas d'incertitude, signale-le et demande une précision.",
    "Commence par une phrase d'accueil courte puis la première question.",
  ].filter(Boolean).join("\n\n");
}

function buildGenerationPrompt(body: JsonRecord) {
  const kind = text(body.kind, 40) || "cours";
  const subject = text(body.subject, 300) || "Sujet non précisé";
  const audience = text(body.audience, 300) || "Public à déterminer";
  const objectives = text(body.objectives, 2_000);
  const instructions = text(body.instructions, 4_000);
  const sourceText = text(body.sourceText, 100_000);

  return [
    "Tu es un ingénieur pédagogique francophone expert.",
    `Crée un ${kind} directement exploitable sur le sujet : ${subject}.`,
    `Public : ${audience}.`,
    objectives ? `Objectifs : ${objectives}.` : "",
    instructions ? `Consignes du formateur : ${instructions}.` : "",
    sourceText ? `Contenu source à analyser intégralement :\n${sourceText}` : "",
    "Le contenu doit être exact, structuré, progressif et adapté au public.",
    "Chaque leçon doit se terminer par un exercice pertinent et sa correction expliquée.",
    "Pour les QCM, varie réellement la position des bonnes réponses entre A, B, C et D.",
    "Pour les jeux, fournis les consignes, les données de jeu, les réponses attendues et le débriefing.",
    "Réponds en JSON valide avec les clés : title, summary, sections, activities, answerKey, sourcesUsed.",
  ].filter(Boolean).join("\n\n");
}

function extractOutputText(payload: JsonRecord) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as JsonRecord).content) ? (item as JsonRecord).content as unknown[] : [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const value = (part as JsonRecord).text;
      return typeof value === "string" ? [value] : [];
    });
  }).join("");
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("origin");
  const origin = allowedOrigin(requestOrigin);
  if (requestOrigin && origin === undefined) return json({ error: "Origine non autorisée." }, 403, null);
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin ?? DEFAULT_ALLOWED_ORIGINS[0],
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405, origin ?? null);

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentification requise." }, 401, origin ?? null);

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) return json({ error: "Connexion IA indisponible." }, 503, origin ?? null);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return json({ error: "Session invalide ou expirée." }, 401, origin ?? null);

  const trustedRole = userData.user.app_metadata?.role;
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  const storedRole = trustedRole ?? profile?.role;
  const role = storedRole === "admin" ? "admin" : storedRole === "formateur" ? "formateur" : "apprenant";

  let body: JsonRecord;
  try {
    const raw = await request.text();
    if (raw.length > 1_200_000) return json({ error: "Requête trop volumineuse." }, 413, origin ?? null);
    body = JSON.parse(raw) as JsonRecord;
  } catch {
    return json({ error: "Requête JSON invalide." }, 400, origin ?? null);
  }

  const action = text(body.action, 40);
  try {
    if (action === "realtime_session") {
      const durationMinutes = numberInRange(body.durationMinutes, 2, role === "admin" ? 120 : 20, 10);
      const response = await fetch(`${OPENAI_API_URL}/realtime/client_secrets`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${openAiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 60 },
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
            output_modalities: ["audio"],
            instructions: buildTutorInstructions(body),
            audio: {
              input: {
                noise_reduction: { type: "near_field" },
                turn_detection: { type: "server_vad", create_response: true, interrupt_response: true },
              },
              output: { voice: "marin", speed: 1.0 },
            },
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`realtime:${response.status}`);
      const session = await response.json() as JsonRecord;
      return json({
        clientSecret: session.value,
        expiresAt: session.expires_at,
        session: session.session,
        limits: { durationMinutes, adminUnlimited: role === "admin" },
      }, 200, origin ?? null);
    }

    if (action === "generate" || action === "analyze_document") {
      const fileUrl = text(body.fileUrl, 2_000);
      if (fileUrl && !fileUrl.startsWith("https://")) return json({ error: "Le document doit utiliser une URL HTTPS." }, 400, origin ?? null);
      const prompt = buildGenerationPrompt(body);
      const content: JsonRecord[] = [{ type: "input_text", text: prompt }];
      if (fileUrl) content.push({ type: "input_file", file_url: fileUrl });
      const useWebSearch = body.useWebSearch === true;
      const response = await fetch(`${OPENAI_API_URL}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${openAiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: GENERATION_MODEL,
          input: [{ role: "user", content }],
          tools: useWebSearch ? [{ type: "web_search" }] : [],
          max_output_tokens: role === "admin" ? 12_000 : 6_000,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`responses:${response.status}`);
      const payload = await response.json() as JsonRecord;
      const outputText = extractOutputText(payload);
      let result: unknown = outputText;
      try { result = JSON.parse(outputText); } catch { /* Le texte brut reste exploitable. */ }
      return json({
        result,
        model: GENERATION_MODEL,
        adminUnlimited: role === "admin",
      }, 200, origin ?? null);
    }

    return json({ error: "Action IA inconnue." }, 400, origin ?? null);
  } catch (error) {
    console.error("pedagogy-ai upstream failure", error instanceof Error ? error.message : "unknown");
    return json({ error: "Le service IA n'a pas pu terminer la demande. Réessayez dans un instant." }, 502, origin ?? null);
  }
});
