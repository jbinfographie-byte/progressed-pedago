import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { learnerAccessEmail, learnerAccessUrl } from '../lib/learner-access-email.ts';

const learnerApi = readFileSync(new URL('../app/api/learners/[id]/route.ts', import.meta.url), 'utf8');
const learnerAdmin = readFileSync(new URL('../components/learner-management-view.tsx', import.meta.url), 'utf8');
const learnerPortal = readFileSync(new URL('../components/learner-portal.tsx', import.meta.url), 'utf8');

test('le lien permanent ouvre directement la connexion apprenant sans secret', () => {
  const url = learnerAccessUrl('https://preview.example.test/api/learners', 'https://progressed-pedago.fr/');
  assert.equal(url, 'https://progressed-pedago.fr/?access=learner');
  assert.doesNotMatch(url, /token|code|password/i);
});

test('le premier mail distingue le lien temporaire du lien permanent', () => {
  const invitationUrl = 'https://progressed-pedago.fr/invite/jeton-temporaire';
  const accessUrl = 'https://progressed-pedago.fr/?access=learner';
  const email = learnerAccessEmail({ firstName: 'Lina', accessUrl, invitationUrl, invitationDays: 7 });
  assert.match(email.text, new RegExp(invitationUrl));
  assert.match(email.text, new RegExp(accessUrl.replace('?', '\\?')));
  assert.match(email.text, /prochaines connexions/);
  assert.match(email.text, /Installer l’application/);
});

test('le mail de retour ne contient ni code ni mot de passe', () => {
  const email = learnerAccessEmail({ firstName: 'Lina', accessUrl: 'https://progressed-pedago.fr/?access=learner' });
  assert.match(email.subject, /Retrouvez votre espace apprenant/);
  assert.doesNotMatch(email.text, /code temporaire|mot de passe\s*:/i);
  assert.match(email.text, /Mot de passe oublié/);
});

test('le renvoi est réservé à l’administrateur et les onglets exposent leur état actif', () => {
  assert.match(learnerApi, /action === 'send_access_link'/);
  assert.match(learnerApi, /actor\.role !== 'admin'/);
  assert.match(learnerApi, /learner\.status !== 'active'/);
  assert.match(learnerAdmin, /Renvoyer le lien de connexion/);
  assert.match(learnerPortal, /aria-current=\{tab==='home'\?'page':undefined\}/);
  assert.match(learnerPortal, /aria-current=\{tab==='results'\?'page':undefined\}/);
});
