'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityPlayer } from '@/components/activity-player';
import { ACTIVITY_TYPES, type ActivityDraft } from '@/lib/activity-types';
import { COURSE_FOLDER_COLORS, type CourseFolderColor } from '@/lib/course-folders';

type ActivityRecord = ActivityDraft & { id:string;status:'draft'|'published';qualityScore:number;updatedAt:number };
type FolderItem = {activityId:string;position:number};
type FolderFileItem = {fileId:string;position:number};
type LibraryFile = {id:string;originalName:string;mimeType:string;sizeBytes:number;status:string;createdAt:number};
type CourseFolder = {id:string;name:string;description:string;color:CourseFolderColor;createdAt:number;updatedAt:number;items:FolderItem[];fileItems:FolderFileItem[]};
type ApiResult<T> = {ok:true;data:T}|{ok:false;error:{message:string}};

const colorLabels: Record<CourseFolderColor,string> = {mint:'Menthe',blue:'Bleu',peach:'Pêche',aqua:'Aqua'};

async function request<T>(url:string,options?:RequestInit):Promise<T> {
  const response = await fetch(url,options); const payload = await response.json() as ApiResult<T>;
  if (!payload.ok) throw new Error(payload.error.message); return payload.data;
}

export function CourseFoldersView({activities,onPlay,notify}:{activities:ActivityRecord[];onPlay:(activity:ActivityRecord)=>void;notify:(message:string)=>void}) {
  const [folders,setFolders] = useState<CourseFolder[]>([]);
  const [libraryFiles,setLibraryFiles] = useState<LibraryFile[]>([]);
  const [selectedId,setSelectedId] = useState('');
  const [editing,setEditing] = useState<CourseFolder|'new'|null>(null);
  const [managing,setManaging] = useState(false);
  const [selectedActivities,setSelectedActivities] = useState<string[]>([]);
  const [selectedFiles,setSelectedFiles] = useState<string[]>([]);
  const [pickerQuery,setPickerQuery] = useState('');
  const [journeyIndex,setJourneyIndex] = useState<number|null>(null);
  const [busy,setBusy] = useState(false);
  const [uploading,setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request<{folders:CourseFolder[];libraryFiles:LibraryFile[]}>('/api/folders');
      setFolders(data.folders); setLibraryFiles(data.libraryFiles);
      setSelectedId((current) => data.folders.some((folder) => folder.id === current) ? current : '');
    } catch (error) { notify(error instanceof Error ? error.message : 'Chargement des dossiers impossible.'); }
  },[notify]);
  useEffect(() => {
    let active = true;
    request<{folders:CourseFolder[];libraryFiles:LibraryFile[]}>('/api/folders').then((data) => {
      if (!active) return; setFolders(data.folders); setLibraryFiles(data.libraryFiles);
    }).catch((error) => notify(error instanceof Error ? error.message : 'Chargement des dossiers impossible.'));
    return () => { active = false; };
  },[notify]);

  const selected = folders.find((folder) => folder.id === selectedId) ?? null;
  const byId = useMemo(() => new Map(activities.map((activity) => [activity.id,activity])),[activities]);
  const filesById = useMemo(() => new Map(libraryFiles.map((file) => [file.id,file])),[libraryFiles]);
  const orderedActivities = useMemo(() => (selected?.items ?? []).slice().sort((a,b) => a.position - b.position).map((item) => byId.get(item.activityId)).filter((activity):activity is ActivityRecord => Boolean(activity)),[selected,byId]);
  const orderedFiles = useMemo(() => (selected?.fileItems ?? []).slice().sort((a,b) => a.position - b.position).map((item) => filesById.get(item.fileId)).filter((file):file is LibraryFile => Boolean(file)),[selected,filesById]);
  const normalizedQuery = pickerQuery.trim().toLowerCase();
  const pickerActivities = useMemo(() => activities.filter((activity) => `${activity.title} ${activity.theme}`.toLowerCase().includes(normalizedQuery)),[activities,normalizedQuery]);
  const pickerFiles = useMemo(() => libraryFiles.filter((file) => `${file.originalName} ${fileKind(file)}`.toLowerCase().includes(normalizedQuery)),[libraryFiles,normalizedQuery]);

  const openFolder = (folder:CourseFolder) => { setSelectedId(folder.id); setManaging(false); setPickerQuery(''); };
  const closeFolder = () => { setSelectedId(''); setManaging(false); setJourneyIndex(null); };
  const startManage = () => {
    setSelectedActivities(orderedActivities.map((activity) => activity.id));
    setSelectedFiles(orderedFiles.map((file) => file.id));
    setPickerQuery(''); setManaging(true);
  };
  const saveItems = async (activityIds:string[],fileIds:string[]) => {
    if (!selected) return; setBusy(true);
    try {
      const result = await request<{message:string}>(`/api/folders/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({activityIds,fileIds})});
      await load(); setManaging(false); notify(result.message);
    } catch (error) { notify(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };
  const deleteFolder = async (folder:CourseFolder) => {
    if (!window.confirm(`Supprimer le dossier « ${folder.name} » ? Son contenu restera dans la bibliothèque.`)) return;
    try { const result = await request<{message:string}>(`/api/folders/${folder.id}`,{method:'DELETE'}); closeFolder(); await load(); notify(result.message); }
    catch (error) { notify(error instanceof Error ? error.message : 'Suppression impossible.'); }
  };
  const moveActivity = async (index:number,direction:-1|1) => {
    const target = index + direction; if (target < 0 || target >= orderedActivities.length) return;
    const ids = orderedActivities.map((activity) => activity.id); [ids[index],ids[target]] = [ids[target],ids[index]];
    await saveItems(ids,orderedFiles.map((file) => file.id));
  };
  const removeActivity = async (activityId:string) => saveItems(orderedActivities.filter((activity) => activity.id !== activityId).map((activity) => activity.id),orderedFiles.map((file) => file.id));
  const removeFile = async (fileId:string) => saveItems(orderedActivities.map((activity) => activity.id),orderedFiles.filter((file) => file.id !== fileId).map((file) => file.id));
  const uploadSupports = async (event:ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []); if (!files.length) return; setUploading(true);
    try {
      const body = new FormData(); files.forEach((file) => body.append('files',file));
      const result = await request<{files:Array<{id:string}>;message:string}>('/api/files',{method:'POST',body});
      setSelectedFiles((current) => [...new Set([...current,...result.files.map((file) => file.id)])]);
      await load(); notify(`${result.message} Les nouveaux supports sont cochés pour ce dossier.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Import impossible.'); }
    finally { setUploading(false); event.target.value = ''; }
  };

  const currentJourneyIndex = journeyIndex ?? 0;
  const journeyActivity = journeyIndex === null ? null : orderedActivities[currentJourneyIndex] ?? null;
  const selectedCount = selectedActivities.length + selectedFiles.length;

  return <section className="folder-library" aria-labelledby="folders-title">
    <div className="folder-library-heading"><div><p className="overline">Classement thématique</p><h3 id="folders-title">Dossiers et parcours apprenants</h3><p>Le tableau de bord affiche uniquement vos dossiers. Cliquez sur un dossier pour ouvrir son contenu et choisir les éléments de votre bibliothèque.</p></div><button className="button dark" type="button" onClick={() => setEditing('new')}>＋ Nouveau dossier</button></div>
    {folders.length ? <div className="folder-grid">{folders.map((folder) => {
      const activityCount = folder.items.filter((item) => byId.has(item.activityId)).length;
      const fileCount = folder.fileItems.filter((item) => filesById.has(item.fileId)).length;
      return <button type="button" className={`folder-card ${folder.color}`} onClick={() => openFolder(folder)} key={folder.id}><span className="folder-tab" aria-hidden="true" /><span className="folder-icon">▰</span><strong>{folder.name}</strong><small>{activityCount} activité{activityCount > 1 ? 's' : ''} · {fileCount} support{fileCount > 1 ? 's' : ''}</small><b>Ouvrir le dossier →</b></button>;
    })}</div> : <div className="folder-empty"><span>▰</span><strong>Créez votre premier dossier thématique</strong><p>Le contenu ne sera visible qu’après avoir ouvert le dossier.</p><button className="button dark" type="button" onClick={() => setEditing('new')}>Créer un dossier</button></div>}

    {selected && <div className="folder-workspace-backdrop" role="dialog" aria-modal="true" aria-labelledby="folder-workspace-title"><article className="folder-workspace">
      <header className="folder-workspace-topbar"><button className="folder-back" type="button" onClick={closeFolder}>← Retour aux dossiers</button><span>Bibliothèque privée · contenu du dossier</span><button className="folder-workspace-close" type="button" onClick={closeFolder} aria-label="Fermer le dossier">×</button></header>
      <section className="folder-detail"><header><div><span className={`folder-dot ${selected.color}`} /><div><p className="overline">À l’intérieur du dossier</p><h3 id="folder-workspace-title">{selected.name}</h3><p>{selected.description || 'Ajoutez une description pour préciser l’objectif de ce parcours.'}</p></div></div><div><button className="button light" type="button" onClick={() => setEditing(selected)}>Renommer</button><button className="button dark" type="button" onClick={startManage}>＋ Intégrer depuis ma bibliothèque</button><button className="button light" type="button" disabled={!orderedActivities.length} onClick={() => setJourneyIndex(0)}>▶ Lancer le parcours</button><button className="icon-danger" type="button" onClick={() => void deleteFolder(selected)} aria-label={`Supprimer le dossier ${selected.name}`}>⌫</button></div></header>

        {managing && <div className="folder-picker"><div className="folder-picker-heading"><div><strong>Ma bibliothèque</strong><small>Cochez les jeux, activités, PowerPoint et documents à intégrer dans ce dossier.</small></div><span>{selectedCount} élément{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}</span></div><div className="folder-picker-toolbar"><input type="search" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="Rechercher dans ma bibliothèque" aria-label="Rechercher un élément à intégrer au dossier" /><button type="button" onClick={() => { setSelectedActivities(activities.map((activity) => activity.id)); setSelectedFiles(libraryFiles.map((file) => file.id)); }}>Tout sélectionner</button><button type="button" onClick={() => { setSelectedActivities([]); setSelectedFiles([]); }}>Tout retirer</button></div><label className="folder-upload-button">{uploading ? 'Import en cours…' : '＋ Importer un PowerPoint ou un document'}<input type="file" multiple disabled={uploading} accept=".ppt,.pptx,.pdf,.docx,.txt,.png,.jpg,.jpeg" onChange={(event) => void uploadSupports(event)} /></label>
          {!!pickerActivities.length && <div className="folder-picker-section"><h4>Jeux et activités</h4><div className="folder-picker-list">{pickerActivities.map((activity) => { const checked = selectedActivities.includes(activity.id); return <label className={checked ? 'selected' : ''} key={activity.id}><input type="checkbox" checked={checked} onChange={(event) => setSelectedActivities((items) => event.target.checked ? [...items,activity.id] : items.filter((id) => id !== activity.id))} /><span><strong>{activity.title}</strong><small>{activity.theme} · {activity.durationMinutes} min</small></span><b>{checked ? 'Dans le dossier' : 'Ajouter'}</b></label>; })}</div></div>}
          {!!pickerFiles.length && <div className="folder-picker-section"><h4>PowerPoint et supports</h4><div className="folder-picker-list">{pickerFiles.map((file) => { const checked = selectedFiles.includes(file.id); return <label className={checked ? 'selected' : ''} key={file.id}><input type="checkbox" checked={checked} onChange={(event) => setSelectedFiles((items) => event.target.checked ? [...items,file.id] : items.filter((id) => id !== file.id))} /><span><strong>{file.originalName}</strong><small>{fileKind(file)} · {formatBytes(file.sizeBytes)}</small></span><b>{checked ? 'Dans le dossier' : 'Ajouter'}</b></label>; })}</div></div>}
          {!pickerActivities.length && !pickerFiles.length && <div className="folder-picker-no-result">Aucun élément ne correspond à cette recherche.</div>}<div className="folder-picker-actions"><button className="button light" type="button" onClick={() => setManaging(false)}>Annuler</button><button className="button dark" type="button" disabled={busy} onClick={() => void saveItems(selectedActivities,selectedFiles)}>{busy ? 'Enregistrement…' : `Intégrer dans le dossier (${selectedCount})`}</button></div></div>}

        {(orderedActivities.length || orderedFiles.length) ? <><div className="folder-group-summary"><strong>{orderedActivities.length + orderedFiles.length} élément{orderedActivities.length + orderedFiles.length > 1 ? 's' : ''} dans ce dossier</strong><span>Les éléments restent également disponibles dans votre bibliothèque.</span></div>{!!orderedActivities.length && <section className="folder-content-section"><h4>Jeux et activités du parcours</h4><ol className="journey-list">{orderedActivities.map((activity,index) => <li key={activity.id}><span className="journey-number">{index + 1}</span><div><small>{ACTIVITY_TYPES.find(([type]) => type === activity.type)?.[1] ?? activity.type}</small><strong>{activity.title}</strong><span>{activity.theme} · {activity.durationMinutes} min</span></div><div><button type="button" disabled={index === 0 || busy} onClick={() => void moveActivity(index,-1)} aria-label={`Monter ${activity.title}`}>↑</button><button type="button" disabled={index === orderedActivities.length - 1 || busy} onClick={() => void moveActivity(index,1)} aria-label={`Descendre ${activity.title}`}>↓</button><button type="button" onClick={() => onPlay(activity)}>Ouvrir</button><button className="danger" type="button" disabled={busy} onClick={() => void removeActivity(activity.id)}>Retirer du dossier</button></div></li>)}</ol></section>}{!!orderedFiles.length && <section className="folder-content-section"><h4>PowerPoint et supports</h4><div className="folder-support-list">{orderedFiles.map((file) => <article key={file.id}><span className="folder-support-icon">{fileIcon(file)}</span><div><strong>{file.originalName}</strong><small>{fileKind(file)} · {formatBytes(file.sizeBytes)}</small></div><a href={`/api/files/${file.id}`}>Télécharger</a><button type="button" disabled={busy} onClick={() => void removeFile(file.id)}>Retirer du dossier</button></article>)}</div></section>}</> : !managing && <div className="folder-empty"><span>▱</span><strong>Ce dossier est vide</strong><p>Cliquez sur le bouton ci-dessous pour afficher votre bibliothèque et cocher les éléments à intégrer.</p><button className="button dark" type="button" onClick={startManage}>＋ Intégrer depuis ma bibliothèque</button></div>}
      </section>
    </article></div>}

    {editing && <FolderDialog folder={editing === 'new' ? null : editing} busy={busy} onClose={() => setEditing(null)} onSave={async (values) => { setBusy(true); try { if (editing === 'new') { const result = await request<{id:string;message:string}>('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}); await load(); notify(result.message); } else { const result = await request<{message:string}>(`/api/folders/${editing.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}); await load(); notify(result.message); } setEditing(null); } catch (error) { notify(error instanceof Error ? error.message : 'Enregistrement impossible.'); } finally { setBusy(false); } }} />}
    {journeyActivity && <ActivityPlayer activity={journeyActivity} onClose={() => setJourneyIndex(null)} journey={{name:selected?.name ?? 'Parcours',index:currentJourneyIndex,total:orderedActivities.length,onPrevious:currentJourneyIndex > 0 ? () => setJourneyIndex(currentJourneyIndex - 1) : undefined,onNext:currentJourneyIndex < orderedActivities.length - 1 ? () => setJourneyIndex(currentJourneyIndex + 1) : undefined}} />}
  </section>;
}

function FolderDialog({folder,busy,onClose,onSave}:{folder:CourseFolder|null;busy:boolean;onClose:()=>void;onSave:(values:{name:string;description:string;color:string})=>Promise<void>}) {
  const submit = (event:FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); void onSave({name:String(form.get('name') ?? ''),description:String(form.get('description') ?? ''),color:String(form.get('color') ?? 'mint')}); };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title"><form className="modal-card folder-dialog" onSubmit={submit}><button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button><p className="overline">Bibliothèque pédagogique</p><h2 id="folder-dialog-title">{folder ? 'Renommer le dossier' : 'Créer un dossier'}</h2><label>Nom du dossier<input name="name" defaultValue={folder?.name ?? ''} required minLength={2} maxLength={80} placeholder="Ex. Sécurité et prévention" /></label><label>Description du parcours<textarea name="description" defaultValue={folder?.description ?? ''} rows={3} maxLength={280} placeholder="Objectifs, public ou progression prévue" /></label><fieldset><legend>Couleur du dossier</legend><div className="folder-color-options">{COURSE_FOLDER_COLORS.map((color) => <label className={color} key={color}><input type="radio" name="color" value={color} defaultChecked={(folder?.color ?? 'mint') === color} /><span>{colorLabels[color]}</span></label>)}</div></fieldset><div className="modal-actions"><button className="button light" type="button" onClick={onClose}>Annuler</button><button className="button dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : folder ? 'Enregistrer' : 'Créer le dossier'}</button></div></form></div>;
}

function fileKind(file:LibraryFile):string {
  if (file.mimeType.includes('presentation') || file.mimeType.includes('powerpoint')) return 'PowerPoint';
  if (file.mimeType === 'application/pdf') return 'PDF';
  if (file.mimeType.includes('wordprocessing')) return 'Document Word';
  if (file.mimeType.startsWith('image/')) return 'Image';
  if (file.mimeType === 'text/plain') return 'Document texte';
  return 'Support pédagogique';
}
function fileIcon(file:LibraryFile):string { return fileKind(file) === 'PowerPoint' ? '▣' : file.mimeType === 'application/pdf' ? '▤' : file.mimeType.startsWith('image/') ? '▧' : '▥'; }
function formatBytes(bytes:number):string { return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1,Math.round(bytes / 1024))} Ko`; }
