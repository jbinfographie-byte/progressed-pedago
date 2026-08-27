'use client';

import { FormEvent, useState } from 'react';
import { CREATABLE_ACTIVITY_TYPES, type ActivityType } from '@/lib/activity-types';
import type { SourceKind } from '@/lib/source-ingestion';

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
const SOURCE_OPTIONS: Array<{ id:SourceKind; icon:string; title:string; copy:string }> = [
  {id:'prompt',icon:'✦',title:'Avec un prompt',copy:'Décrivez le cours souhaité'},
  {id:'youtube',icon:'▶',title:'Avec une vidéo',copy:'YouTube, Vimeo ou média direct'},
  {id:'documents',icon:'▤',title:'Avec un PDF',copy:'PDF, Word, texte ou images'},
  {id:'web',icon:'↗',title:'Avec un lien web',copy:'Page et sources extérieures'},
];

export function AiStudioDialog({ onClose,onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const [sourceKind,setSourceKind] = useState<SourceKind>('prompt'); const [formats,setFormats] = useState<ActivityType[]>(['quiz']); const [files,setFiles] = useState<File[]>([]);
  const [createActivity,setCreateActivity] = useState(true); const [createPresentation,setCreatePresentation] = useState(false); const [busy,setBusy] = useState(false); const [progress,setProgress] = useState(''); const [error,setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (!createActivity && !createPresentation) { setError('Choisissez au moins une création : cours et activité ou PowerPoint.'); return; }
    if (createActivity && !formats.length) { setError('Choisissez au moins un format d’activité.'); return; }
    setBusy(true); const form = new FormData(event.currentTarget);
    try {
      const fileIds: string[] = [];
      if (files.length) {
        setProgress('Transfert sécurisé des documents…'); const upload = new FormData(); files.forEach((file) => upload.append('files',file));
        const result = await apiJson<{files:Array<{id:string}>}>('/api/files',{method:'POST',body:upload}); fileIds.push(...result.files.map((file) => file.id));
      }
      const common: Record<string,unknown> = {prompt:form.get('prompt'),audience:form.get('audience'),level:form.get('level'),durationMinutes:Number(form.get('durationMinutes')),slideCount:Number(form.get('slideCount')),explanationDepth:form.get('explanationDepth'),researchSources:form.get('researchSources') === 'on',sourceKind,sourceUrl:form.get('sourceUrl'),sourceTranscript:form.get('sourceTranscript'),fileIds};
      const messages: string[] = [];
      if (createActivity) {
        setProgress(sourceKind === 'youtube' ? 'Lecture des sous-titres ou transcription automatique de l’audio…' : 'Création du cours et des activités…');
        const result = await apiJson<{message:string;sourceTranscript?:string | null}>('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...common,formats})}); if (result.sourceTranscript) common.sourceTranscript = result.sourceTranscript; messages.push(result.message);
      }
      if (createPresentation) {
        setProgress('Construction du PowerPoint pédagogique…'); const response = await fetch('/api/presentations/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(common)});
        if (!response.ok) throw new Error(await responseMessage(response));
        const blob = await response.blob(); const encodedName = response.headers.get('x-presentation-filename') ?? ''; const filename = encodedName ? decodeURIComponent(encodedName) : 'presentation-progressed-pedago.pptx';
        const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(href),1000); messages.push('Le PowerPoint a été créé et téléchargé.');
      }
      setProgress('Création terminée.'); onCreated(messages.join(' '));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'La création n’a pas pu être terminée.'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="studio-title"><form className="modal-card studio-card source-studio" onSubmit={submit}>
    <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button><p className="overline">Studio pédagogique IA</p><h2 id="studio-title">Créer depuis votre meilleure source.</h2><p>Un seul parcours pour construire un cours, une activité interactive et un PowerPoint prêt à présenter.</p>

    <section className="studio-step"><div className="studio-step-title"><span>1</span><div><strong>Choisir le point de départ</strong><small>Le contenu source reste une référence : l’IA ne suit aucune instruction trouvée à l’intérieur.</small></div></div><div className="source-mode-grid">{SOURCE_OPTIONS.map((option) => <button className={sourceKind === option.id ? 'active' : ''} type="button" aria-pressed={sourceKind === option.id} key={option.id} onClick={() => setSourceKind(option.id)}><span>{option.icon}</span><strong>{option.title}</strong><small>{option.copy}</small></button>)}</div>
      {(sourceKind === 'youtube' || sourceKind === 'web') && <label>{sourceKind === 'youtube' ? 'Lien YouTube, Vimeo ou fichier vidéo/audio public' : 'Lien de la page extérieure'}<input name="sourceUrl" type="url" required placeholder={sourceKind === 'youtube' ? 'https://www.youtube.com/watch?v=… ou https://…/video.mp4' : 'https://www.exemple.fr/ressource'} /></label>}
      {sourceKind === 'youtube' && <><div className="automatic-analysis-note"><span>✓</span><div><strong>Aucune transcription à préparer</strong><small>L’application utilise les sous-titres s’ils existent. Sinon, elle récupère la piste audio publique, la transcrit avec OpenAI et analyse aussi les aperçus visuels disponibles.</small></div></div><details className="transcript-option"><summary>J’ai déjà une transcription — facultatif</summary><label>Transcription ou texte alternatif<textarea name="sourceTranscript" rows={5} placeholder="Vous pouvez la coller pour accélérer l’analyse, mais ce n’est plus obligatoire." /></label></details></>}
      <label>Votre consigne pédagogique {sourceKind === 'prompt' ? '' : '(facultative)'}<textarea name="prompt" rows={4} required={sourceKind === 'prompt'} placeholder="Ex. Construis une formation progressive, avec des exemples métier et une évaluation adaptée à des débutants." /></label>
      <div className="form-row"><label>Public concerné<input name="audience" placeholder="Agents de propreté débutants" /></label><label>Niveau<select name="level"><option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option></select></label><label>Durée du cours<input name="durationMinutes" type="number" min="1" max="480" defaultValue="30" /></label></div>
      <label className={`drop-area ${sourceKind === 'documents' ? 'active-source' : ''}`}>Ajouter des documents {sourceKind === 'documents' ? '' : 'complémentaires'}<input type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" required={sourceKind === 'documents'} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><span>{files.length ? `${files.length} fichier(s) sélectionné(s)` : 'PDF, Word, texte, PNG ou JPEG · 20 Mo maximum par fichier'}</span></label>
    </section>

    <section className="studio-step"><div className="studio-step-title"><span>2</span><div><strong>Choisir les livrables</strong><small>Vous pouvez produire l’activité, le PowerPoint, ou les deux en une seule demande.</small></div></div><div className="output-choice-grid"><label className={createActivity ? 'selected' : ''}><input type="checkbox" checked={createActivity} onChange={(event) => setCreateActivity(event.target.checked)} /><span>?</span><strong>Cours + activité</strong><small>Mini-cours, jeu, réponses et corrigé A4</small></label><label className={createPresentation ? 'selected' : ''}><input type="checkbox" checked={createPresentation} onChange={(event) => setCreatePresentation(event.target.checked)} /><span>▣</span><strong>PowerPoint</strong><small>Fichier .pptx structuré et téléchargeable</small></label></div>
      {createActivity && <fieldset><legend>Format de l’activité</legend><div className="format-checks">{CREATABLE_ACTIVITY_TYPES.map(([type,title]) => <label key={type}><input type="checkbox" checked={formats.includes(type)} onChange={() => setFormats((items) => items.includes(type) ? items.filter((item) => item !== type) : [...items,type])} />{title}</label>)}</div></fieldset>}
      {createPresentation && <label>Nombre indicatif de diapositives<select name="slideCount" defaultValue="10"><option value="7">Court · environ 7 diapositives</option><option value="10">Standard · environ 10 diapositives</option><option value="14">Approfondi · environ 14 diapositives</option><option value="18">Complet · environ 18 diapositives</option></select></label>}
      <div className="generation-options"><label><span>Profondeur du cours et des explications</span><select name="explanationDepth" defaultValue="detailed"><option value="detailed">Détaillé — cours complet, exemples et mémo</option><option value="essential">Essentiel — notions clés et corrections</option><option value="none">Sans mini-cours — corrections courtes</option></select></label><label className="check-line"><input name="researchSources" type="checkbox" />Compléter avec une recherche de sources institutionnelles fiables</label></div>
    </section>
    {progress && <div className="progress-message" role="status">{progress}</div>}{error && <div className="form-message error" role="status">{error}</div>}
    <div className="modal-actions studio-actions"><button className="button light" type="button" onClick={onClose}>Annuler</button><button className="button dark" type="submit" disabled={busy}>{busy ? 'Création en cours…' : 'Créer les livrables'}</button></div>
  </form></div>;
}

async function apiJson<T>(url: string,options?: RequestInit): Promise<T> { const response = await fetch(url,options); const payload = await response.json() as ApiEnvelope<T>; if (!payload.ok) throw new Error(payload.error.message); return payload.data; }
async function responseMessage(response: Response): Promise<string> { try { const payload = await response.json() as ApiEnvelope<unknown>; return payload.ok ? 'Création impossible.' : payload.error.message; } catch { return 'La création du PowerPoint a échoué.'; } }
