import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as Record<string, unknown>;
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../components/progressed-app.tsx', import.meta.url), 'utf8');
const installSource = readFileSync(new URL('../components/install-app.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('le manifeste permet une installation autonome avec des icônes adaptées', () => {
  assert.equal(manifest.name, 'Progressed Pédago');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  const icons = manifest.icons as Array<{ sizes: string; purpose?: string }>;
  assert.ok(icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(icons.some((icon) => icon.sizes === '512x512' && icon.purpose?.includes('maskable')));
});

test('le service worker ne met pas en cache les pages privées ni les API', () => {
  assert.match(serviceWorker, /INSTALL_ASSETS\.includes\(url\.pathname\)/);
  assert.doesNotMatch(serviceWorker, /\/api\//);
});

test('l’installation est proposée dans la navigation sans bouton flottant', () => {
  assert.match(appSource, /<nav aria-label="Navigation principale">[\s\S]*<InstallApp \/>[\s\S]*<\/nav>/);
  assert.doesNotMatch(styles, /\.install-app-trigger\s*\{[^}]*position:\s*fixed/);
});

test('le parcours propose une installation directe et un guide multi-appareils', () => {
  assert.match(installSource, /beforeinstallprompt/);
  assert.match(installSource, /Installer maintenant/);
  assert.match(installSource, /Sur iPhone ou iPad/);
  assert.match(installSource, /ordinateur Windows/);
  assert.match(installSource, /Ajouter au Dock/);
});
