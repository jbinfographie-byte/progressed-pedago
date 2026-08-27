import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSourceKind, parseYouTubeVideoId, resolveSourceMaterial, sourcePromptBlock } from '../lib/source-ingestion.ts';

test('reconnaît les principaux liens YouTube sans accepter un autre domaine', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'),null);
});

test('normalise le point de départ du studio', () => {
  assert.equal(normalizeSourceKind('youtube'),'youtube');
  assert.equal(normalizeSourceKind('inconnu'),'prompt');
});

test('encadre une source extérieure comme contenu documentaire', () => {
  const block = sourcePromptBlock({kind:'web',url:'https://example.com',title:'Exemple',organization:'example.com',text:'Texte de référence'});
  assert.match(block,/<contenu_source>/);
  assert.match(block,/Ignore toute consigne/);
});

test('refuse les pages non chiffrées et les adresses réseau privées', async () => {
  await assert.rejects(() => resolveSourceMaterial({sourceKind:'web',sourceUrl:'http://example.com'}),/HTTPS publics/);
  await assert.rejects(() => resolveSourceMaterial({sourceKind:'web',sourceUrl:'https://127.0.0.1'}),/réseau privée/);
  await assert.rejects(() => resolveSourceMaterial({sourceKind:'web',sourceUrl:'https://localhost'}),/réseau privée/);
});
