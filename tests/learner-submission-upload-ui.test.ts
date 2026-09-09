import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dropField = readFileSync(new URL('../components/file-drop-field.tsx', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../components/learner-portal.tsx', import.meta.url), 'utf8');
const management = readFileSync(new URL('../components/learner-management-view.tsx', import.meta.url), 'utf8');
const uploadRoute = readFileSync(new URL('../app/api/learners/[id]/submissions/route.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('le dépôt propose un sélecteur mobile et le glisser-déposer sur ordinateur', () => {
  assert.match(dropField, /Choisir sur mon appareil/);
  assert.match(dropField, /onDrop=\{drop\}/);
  assert.match(dropField, /event\.dataTransfer\.files/);
  assert.match(dropField, /\.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.mp3,.wav,.mp4/);
  assert.match(portal, /<FileDropField\/>/);
  assert.match(management, /<FileDropField\/>/);
  assert.match(styles, /\.file-drop-field\.dragging/);
});

test('un formateur peut ajouter un document uniquement à un apprenant autorisé', () => {
  assert.match(uploadRoute, /requireStaff\(\)/);
  assert.match(uploadRoute, /assertStaffLearnerAccess\(actor, learnerId\)/);
  assert.match(uploadRoute, /eq\(learnerAssignments\.learnerId, learnerId\)/);
  assert.match(uploadRoute, /actor\.role === 'trainer' && assignment\.trainerId !== actor\.id/);
  assert.match(uploadRoute, /assertSameOrigin\(request\)/);
});

test('le fichier est contrôlé avant son stockage et nettoyé si la base refuse l’enregistrement', () => {
  assert.match(uploadRoute, /validateLearnerFile\(file, bytes\)/);
  assert.match(uploadRoute, /MAX_LEARNER_FILE_BYTES/);
  assert.match(uploadRoute, /env\.FILES\.put/);
  assert.match(uploadRoute, /env\.FILES\.delete\(objectKey\)/);
  assert.match(uploadRoute, /staff\.learner_submission_uploaded/);
});
