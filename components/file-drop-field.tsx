'use client';

import { DragEvent, useEffect, useId, useRef, useState } from 'react';

const ACCEPTED_FILES = '.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.mp3,.wav,.mp4';

export function FileDropField({ required = true }: { required?: boolean }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => setFileName('');
    form.addEventListener('reset', clear);
    return () => form.removeEventListener('reset', clear);
  }, []);

  const receiveFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    setFileName(file.name);
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    receiveFiles(event.dataTransfer.files);
  };

  return <div className={`file-drop-field${dragging ? ' dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={drop}>
    <span className="file-drop-icon" aria-hidden="true">⇧</span>
    <div>
      <strong>{fileName || 'Déposez votre document ici'}</strong>
      <p>{fileName ? 'Le document est prêt à être envoyé.' : 'Sur ordinateur, glissez-déposez le fichier dans cette zone.'}</p>
      <small>PDF, Word, Excel, PowerPoint, image, audio ou vidéo · 25 Mo maximum</small>
    </div>
    <label className="button light file-picker-button" htmlFor={inputId}>Choisir sur mon appareil</label>
    <input ref={inputRef} id={inputId} className="visually-hidden-file" name="file" type="file" accept={ACCEPTED_FILES} required={required} onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? '')}/>
  </div>;
}
