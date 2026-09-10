import { AppError } from './app-error.ts';
import type { MediaTranscriptionInput } from './source-ingestion.ts';

export async function transcribeMediaWithOpenAI(apiKey: string, media: MediaTranscriptionInput): Promise<string> {
  const form = new FormData();
  form.append('file',new Blob([media.data],{type:media.mimeType}),media.filename);
  form.append('model','gpt-4o-mini-transcribe');
  form.append('response_format','json');
  form.append('language','fr');
  form.append('prompt','Transcription fidèle d’une vidéo de formation. Conserver les termes métier, les étapes, les consignes de sécurité, les nombres et les exemples.');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form});
  let payload: { text?: string; error?: { code?: string } } = {};
  try { payload = await response.json() as typeof payload; } catch { /* Une erreur sans JSON est transformée ci-dessous. */ }
  if (!response.ok) {
    if (response.status === 401) throw new AppError(400,'La clé OpenAI enregistrée est invalide. Reconnectez-la dans Connexions.','OPENAI_INVALID_KEY');
    if (response.status === 429 || payload.error?.code?.includes('quota')) throw new AppError(429,'Le quota OpenAI est dépassé ou la facturation est inactive.','OPENAI_QUOTA');
    if (response.status === 413) throw new AppError(413,'La piste audio est trop volumineuse pour être transcrite. Choisissez une vidéo plus courte.','TRANSCRIPTION_FILE_TOO_LARGE');
    throw new AppError(502,'La transcription automatique de la vidéo a été interrompue. Réessayez dans quelques instants.','OPENAI_TRANSCRIPTION_ERROR');
  }
  const transcript = String(payload.text ?? '').replace(/\s+/g,' ').trim();
  if (transcript.length < 80) throw new AppError(422,'La vidéo ne contient pas assez de paroles exploitables pour construire un cours fiable.','TRANSCRIPTION_TOO_SHORT');
  return transcript.slice(0,60000);
}
