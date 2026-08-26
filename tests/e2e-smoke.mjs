import assert from 'node:assert/strict';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const origin = new URL(baseUrl).origin;
const adminEmail = 'admin@progressed.local';
const adminPassword = 'AdminLocal#2026!';
const trainerPassword = 'FormateurLocal#2026!';
const trainerEmail = `formateur.${Date.now()}@example.test`;

async function call(path, { cookie = '', method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`${method} ${path}: ${response.status} ${payload?.error?.message ?? 'échec'}`);
  return { data: payload.data, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie };
}

async function callError(path, { cookie = '', method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  assert.equal(response.ok, false, `${method} ${path} aurait dû être refusé`);
  return { status: response.status, error: payload.error };
}

let admin;
try {
  admin = await call('/api/auth/register', { method: 'POST', body: { email: adminEmail, password: adminPassword, bootstrapToken: 'LocalBootstrap#2026!' } });
} catch (error) {
  if (!String(error).includes('Un compte existe déjà')) throw error;
  admin = await call('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
}
assert.ok(admin.cookie, 'la session administrateur doit être créée');

const registration = await call('/api/auth/register', { method: 'POST', body: { firstName: 'Lina', lastName: 'Martin', email: trainerEmail, password: trainerPassword } });
assert.equal(registration.data.status, 'pending');

const pending = await call('/api/admin/requests', { cookie: admin.cookie });
const request = pending.data.requests.find((item) => item.email === trainerEmail);
assert.ok(request?.trainerId, 'la demande formateur doit apparaître côté administration');
assert.equal(request.firstName, 'Lina');
assert.equal(request.lastName, 'Martin');
assert.equal(request.accessLevel, 'limited');

const mediumPermissions = { ...request.permissions, deleteActivities:true, publishActivities:true, uploadDocuments:true, manageResources:true };
const permissionUpdate = await call('/api/admin/requests', { cookie: admin.cookie, method: 'POST', body: { trainerId: request.trainerId, action: 'update_permissions', permissions: mediumPermissions } });
assert.equal(permissionUpdate.data.accessLevel, 'medium');

const approval = await call('/api/admin/requests', { cookie: admin.cookie, method: 'POST', body: { trainerId: request.trainerId, action: 'approve' } });
assert.equal(approval.data.sent, false);

const trainer = await call('/api/auth/login', { method: 'POST', body: { email: trainerEmail, password: trainerPassword } });
assert.ok(trainer.cookie, 'la session formateur doit être créée après autorisation');
assert.equal(trainer.data.user.permissions.useAi, false);

const deniedAi = await callError('/api/generate', { cookie: trainer.cookie, method: 'POST', body: { prompt: 'Créer un quiz', formats:['quiz'] } });
assert.equal(deniedAi.status, 403);
assert.equal(deniedAi.error.code, 'PERMISSION_REQUIRED');

const deniedExport = await callError('/api/results/export', { cookie: trainer.cookie });
assert.equal(deniedExport.status, 403);
assert.equal(deniedExport.error.code, 'PERMISSION_REQUIRED');

const draft = {
  type: 'quiz',
  title: 'Sécurité chimique — démonstration',
  theme: 'Prévention des risques',
  audience: 'Agents de propreté débutants',
  level: 'debutant',
  objectives: ['Identifier une situation dangereuse', 'Choisir la protection adaptée'],
  durationMinutes: 12,
  instructions: 'Choisissez la bonne réponse puis lisez la correction.',
  explanation: 'Un produit ne doit jamais être mélangé sans instruction du fabricant.',
  correction: 'La fiche de données de sécurité et l’étiquette guident le choix.',
  sources: [{ title: 'INRS — Risques chimiques', url: 'https://www.inrs.fr/risques/chimiques.html' }],
  status: 'published',
  content: { questions: [{ question: 'Que faut-il consulter avant d’utiliser un produit inconnu ?', choices: ['La fiche de données de sécurité', 'Le planning des congés', 'La météo'], correctIndex: 0, explanation: 'La fiche de données de sécurité décrit les dangers et précautions.' }] },
};
const created = await call('/api/activities', { cookie: trainer.cookie, method: 'POST', body: draft });
assert.ok(created.data.id);

const result = await call('/api/results', { method: 'POST', body: { activityId: created.data.id, firstName: 'Lina', lastName: 'Martin', score: 1, maxScore: 1, durationSeconds: 48, answers: [{ question: 0, answer: 0 }] } });
assert.ok(result.data.id);

const library = await call('/api/activities', { cookie: trainer.cookie });
assert.ok(library.data.activities.some((activity) => activity.id === created.data.id && activity.status === 'published'));
const results = await call('/api/results', { cookie: trainer.cookie });
assert.ok(results.data.results.some((row) => row.activityId === created.data.id && row.percentage === 100));

const resource = await call('/api/resources', { cookie: trainer.cookie, method: 'POST', body: { name: 'INRS', url: 'https://www.inrs.fr/', category: 'Autre' } });
assert.ok(resource.data.id);

const resetRequest = await call('/api/auth/password-reset/request', { method: 'POST', body: { email: trainerEmail } });
assert.match(resetRequest.data.message,/30 minutes/);

console.log(`Parcours complet validé : admin → ${trainerEmail} → profil moyen → autorisation → activité publiée → résultat → ressource.`);
