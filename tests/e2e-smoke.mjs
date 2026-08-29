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

async function raw(path,{cookie='',method='GET'}={}){
  return fetch(`${baseUrl}${path}`,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{})}});
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
const pathActivityIds=[created.data.id];
for(let index=2;index<=10;index+=1){const activity=await call('/api/activities',{cookie:trainer.cookie,method:'POST',body:{...draft,title:`Sécurité chimique — étape ${index}`}});pathActivityIds.push(activity.data.id);}
assert.equal(pathActivityIds.length,10,'le parcours de contrôle doit contenir dix activités');

const mainFolder = await call('/api/main-folders', { cookie: trainer.cookie, method: 'POST', body: { name: 'Propreté et hygiène', description: 'Grand thème métier', sector: 'Services', audience: 'Agents de propreté', keywords:['hygiène','sécurité'], competencies:['Organiser son intervention'], color:'mint' } });
assert.ok(mainFolder.data.id);

const trainingPayloads = [
  { name:'Les bases du nettoyage professionnel',level:'debutant',durationMinutes:60 },
  { name:'Bionettoyage d’une chambre en EHPAD',level:'intermediaire',durationMinutes:90 },
  { name:'Préparation et organisation du chariot',level:'debutant',durationMinutes:45 },
];
const generatedTrainings = [];
for (const item of trainingPayloads) generatedTrainings.push(await call('/api/folders',{cookie:trainer.cookie,method:'POST',body:{mainFolderId:mainFolder.data.id,...item,audience:'Agents de propreté',objectives:['Appliquer le protocole'],competencies:['Travailler en sécurité'],status:'draft',color:'blue'}}));
assert.equal(generatedTrainings.length,3);

const hierarchyBefore = await call('/api/folders',{cookie:trainer.cookie});
assert.equal(hierarchyBefore.data.mainFolders.find((item)=>item.id===mainFolder.data.id)?.name,'Propreté et hygiène');
assert.equal(hierarchyBefore.data.folders.filter((item)=>item.mainFolderId===mainFolder.data.id).length,3);
const firstTrainingId = generatedTrainings[0].data.id; const firstPathId = generatedTrainings[0].data.pathId;
await call(`/api/folders/${firstTrainingId}`,{cookie:trainer.cookie,method:'PATCH',body:{pathItems:pathActivityIds.map((activityId,index)=>({activityId,required:true,minScore:index===0?70:0,unlockAfterPrevious:index>0})),status:'published'}});

const hierarchyAfter = await call('/api/folders',{cookie:trainer.cookie});
const persistedTraining = hierarchyAfter.data.folders.find((item)=>item.id===firstTrainingId);
assert.equal(persistedTraining.path.items[0].activityId,created.data.id);
assert.equal(persistedTraining.path.items[0].minScore,70);
assert.equal(persistedTraining.path.items.length,10);
assert.equal(persistedTraining.status,'published');

const adminHierarchy = await call('/api/folders',{cookie:admin.cookie});
assert.equal(adminHierarchy.data.mainFolders.some((item)=>item.id===mainFolder.data.id),false,'un autre compte ne doit jamais voir les dossiers du formateur');

const result = await call('/api/results', { method: 'POST', body: { activityId: created.data.id, trainingId:firstTrainingId, pathId:firstPathId, firstName: 'Lina', lastName: 'Martin', score: 1, maxScore: 1, durationSeconds: 48, answers: [{ question: 0, answer: 0 }] } });
assert.ok(result.data.id);

const library = await call('/api/activities', { cookie: trainer.cookie });
assert.ok(library.data.activities.some((activity) => activity.id === created.data.id && activity.status === 'published'));
const results = await call('/api/results', { cookie: trainer.cookie });
assert.ok(results.data.results.some((row) => row.activityId === created.data.id && row.trainingId === firstTrainingId && row.mainFolderTitle === 'Propreté et hygiène' && row.percentage === 100));

const resource = await call('/api/resources', { cookie: trainer.cookie, method: 'POST', body: { name: 'INRS', url: 'https://www.inrs.fr/', category: 'Autre' } });
assert.ok(resource.data.id);

const youtubeResource=await call('/api/resources',{cookie:trainer.cookie,method:'POST',body:{name:'Vidéo de préparation',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',provider:'youtube',resourceType:'video',trainingId:firstTrainingId,activityId:created.data.id,placement:'before',required:true,openMode:'site'}});
assert.ok(youtubeResource.data.id);
const linkedHierarchy=await call('/api/folders',{cookie:trainer.cookie});
assert.equal(linkedHierarchy.data.folders.find((item)=>item.id===firstTrainingId).resources.some((item)=>item.id===youtubeResource.data.id&&item.openMode==='site'),true);

const connections=await call('/api/connections',{cookie:trainer.cookie});
assert.deepEqual(connections.data.connections.map((item)=>item.provider),['microsoft','google','canva']);
const unconfiguredMicrosoft=await callError('/api/connections/microsoft/start',{cookie:trainer.cookie,method:'POST'});
assert.equal(unconfiguredMicrosoft.status,503);
assert.equal(unconfiguredMicrosoft.error.code,'PROVIDER_CONFIGURATION_REQUIRED');

const createdShare=await call('/api/shares',{cookie:trainer.cookie,method:'POST',body:{trainingId:firstTrainingId,mode:'home',identityMode:'pseudonym',maxAccesses:50}});
assert.ok(createdShare.data.share.url);
const shareId=createdShare.data.share.id;const publicToken=decodeURIComponent(new URL(createdShare.data.share.url).pathname.split('/').pop());const publicPath=`/api/public/shares/${encodeURIComponent(publicToken)}`;
const publicTraining=await call(publicPath);
assert.equal(publicTraining.data.path.items.length,10);
assert.equal(publicTraining.data.participant,null);
const learner=await call(`${publicPath}/participants`,{method:'POST',body:{pseudonym:'Lina-QR'}});
assert.ok(learner.cookie);assert.match(learner.data.resumeCode,/^[A-Z0-9]{6,8}$/);
const firstItem=publicTraining.data.path.items[0];const secondItem=publicTraining.data.path.items[1];
const firstProgress=await call(`${publicPath}/progress`,{cookie:learner.cookie,method:'PATCH',body:{pathItemId:firstItem.pathItemId,status:'passed',score:1,maxScore:1,durationSeconds:25,answers:[0]}});
assert.equal(firstProgress.data.progressPercent,10);assert.equal(firstProgress.data.status,'passed');
const secondProgress=await call(`${publicPath}/progress`,{cookie:learner.cookie,method:'PATCH',body:{pathItemId:secondItem.pathItemId,status:'passed',score:1,maxScore:1,durationSeconds:20,answers:[0]}});
assert.equal(secondProgress.data.progressPercent,20);
const resumed=await call(publicPath,{cookie:learner.cookie});
assert.equal(resumed.data.participant.progressPercent,20);assert.equal(resumed.data.participant.lastPathItemId,secondItem.pathItemId);
const liveParticipants=await call(`/api/shares/${shareId}/participants`,{cookie:trainer.cookie});
assert.equal(liveParticipants.data.participants.some((item)=>item.displayName==='Lina-QR'&&item.progressPercent===20),true);
const sessionResults=await call(`/api/results?shareId=${shareId}`,{cookie:trainer.cookie});
assert.equal(sessionResults.data.results.length,2);assert.equal(sessionResults.data.results.every((item)=>item.sessionShortCode===createdShare.data.share.shortCode),true);
const qrPng=await raw(`/api/shares/${shareId}/qr?format=png`,{cookie:trainer.cookie});assert.equal(qrPng.status,200);assert.match(qrPng.headers.get('content-type')??'',/image\/png/);
const qrPdf=await raw(`/api/shares/${shareId}/qr?format=pdf`,{cookie:trainer.cookie});assert.equal(qrPdf.status,200);assert.match(qrPdf.headers.get('content-type')??'',/application\/pdf/);

await call('/api/admin/requests',{cookie:admin.cookie,method:'POST',body:{trainerId:request.trainerId,action:'update_permissions',permissions:{...mediumPermissions,exportResults:true}}});
const excelExport=await raw(`/api/results/export?shareId=${shareId}&format=excel`,{cookie:trainer.cookie});assert.equal(excelExport.status,200);assert.match(excelExport.headers.get('content-type')??'',/application\/vnd.ms-excel/);
const pdfExport=await raw(`/api/results/export?shareId=${shareId}&format=pdf`,{cookie:trainer.cookie});assert.equal(pdfExport.status,200);assert.match(pdfExport.headers.get('content-type')??'',/application\/pdf/);
if(process.env.KEEP_SHARE_ACTIVE==='1')console.log(`QA_SHARE_URL=${baseUrl}/join/${encodeURIComponent(publicToken)}`);else{await call(`/api/shares/${shareId}`,{cookie:trainer.cookie,method:'PATCH',body:{status:'disabled'}});const disabledShare=await callError(publicPath,{cookie:learner.cookie});assert.equal(disabledShare.status,410);assert.equal(disabledShare.error.code,'SHARE_DISABLED');}

const resetRequest = await call('/api/auth/password-reset/request', { method: 'POST', body: { email: trainerEmail } });
assert.match(resetRequest.data.message,/30 minutes/);

console.log(`Parcours complet validé : admin → ${trainerEmail} → droits → hiérarchie → 10 activités → ressource externe → QR anonyme → reprise à 20 % → résultats session → PNG/PDF/Excel → révocation.`);
