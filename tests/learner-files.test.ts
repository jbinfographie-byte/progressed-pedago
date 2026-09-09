import assert from 'node:assert/strict';
import test from 'node:test';
import { safeFileName, validateLearnerFile } from '../lib/learner-files.ts';

function file(name: string, type: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type });
}

test('accepte les principaux formats apprenant lorsque leur signature est valide', () => {
  const samples = [
    ['travail.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.7')],
    ['photo.png', 'image/png', Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],
    ['document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Uint8Array.from([0x50,0x4b,0x03,0x04])],
    ['oral.wav', 'audio/wav', new TextEncoder().encode('RIFF0000WAVE')],
    ['video.mp4', 'video/mp4', new TextEncoder().encode('0000ftyp')],
  ] as const;
  for (const [name, type, bytes] of samples) assert.doesNotThrow(() => validateLearnerFile(file(name, type, bytes), bytes));
});

test('refuse un script renommé en document pédagogique', () => {
  const bytes = new TextEncoder().encode('<script>alert(1)</script>');
  assert.throws(() => validateLearnerFile(file('devoir.pdf', 'application/pdf', bytes), bytes), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'FILE_SIGNATURE_INVALID'));
});

test('refuse les extensions exécutables et nettoie les noms de stockage', () => {
  const bytes = new TextEncoder().encode('MZ');
  assert.throws(() => validateLearnerFile(file('virus.exe', 'application/octet-stream', bytes), bytes), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'FILE_TYPE_NOT_ALLOWED'));
  assert.equal(safeFileName('../../Dépôt final (1).pdf'), 'Depot-final-1-.pdf');
});
