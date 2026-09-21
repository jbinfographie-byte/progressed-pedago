import test from 'node:test';
import assert from 'node:assert/strict';
import { externalGameValidationErrors, externalResourceEmbedUrl, extractExternalGameUrl, inspectExternalHtml, normalizeExternalGameContent, providerFromExternalGameUrl, wordwallEmbedFromOEmbedHtml } from '../lib/external-games.ts';

test('extrait uniquement la source HTTPS d’un iframe Wordwall',()=>{
  const input='<iframe style="max-width:100%" src="https://wordwall.net/fr/embed/b54fc7aa480c4254876c2d199faa26c0?themeId=1" onload="alert(1)" allowfullscreen></iframe>';
  assert.equal(extractExternalGameUrl(input),'https://wordwall.net/fr/embed/b54fc7aa480c4254876c2d199faa26c0?themeId=1');
  assert.equal(providerFromExternalGameUrl(extractExternalGameUrl(input)!),'wordwall');
});

test('refuse le HTTP, les scripts et les adresses privées',()=>{
  assert.equal(extractExternalGameUrl('http://wordwall.net/fr/embed/demo'),null);
  assert.equal(extractExternalGameUrl('<script>alert(1)</script><iframe src="https://wordwall.net/fr/embed/demo"></iframe>'),null);
  assert.equal(extractExternalGameUrl('https://127.0.0.1/game'),null);
  assert.equal(extractExternalGameUrl('https://192.168.1.2/game'),null);
  assert.equal(extractExternalGameUrl('https://[::1]/game'),null);
});

test('nettoie un fichier HTML et extrait uniquement sa ressource HTTPS',()=>{
  const imported=inspectExternalHtml(`<!doctype html><html><head><title>Quiz &amp; sécurité</title><script>alert('jamais exécuté')</script></head><body><h1>Prévention des chutes</h1><iframe src="https://wordwall.net/fr/embed/demo?themeId=1" onload="steal()"></iframe><p>Associez chaque risque à la bonne prévention.</p></body></html>`);
  assert.equal(imported?.sourceUrl,'https://wordwall.net/fr/embed/demo?themeId=1');
  assert.equal(imported?.provider,'wordwall');
  assert.equal(imported?.title,'Quiz & sécurité');
  assert.match(imported?.readableText??'',/Prévention des chutes/);
  assert.doesNotMatch(imported?.readableText??'',/jamais exécuté|steal/);
});

test('refuse un fichier HTML sans adresse externe HTTPS intégrable',()=>{
  assert.equal(inspectExternalHtml('<html><body><iframe src="javascript:alert(1)"></iframe></body></html>'),null);
  assert.equal(inspectExternalHtml('<html><body><a href="http://example.org/game">Jeu</a></body></html>'),null);
});

test('normalise le contenu papier et n’invente pas de score',()=>{
  const game=normalizeExternalGameContent({embedUrl:'https://example.org/game',scoreMode:'manual_completion',paper:{learnerVersion:true,trainerVersion:false,questions:[{question:'Pourquoi ?',answer:'Parce que.'}]}});
  assert.equal(game.embedUrl,'https://example.org/game');
  assert.equal(game.scoreMode,'manual_completion');
  assert.deepEqual(game.paper.questions,[{question:'Pourquoi ?',answer:'Parce que.'}]);
  assert.deepEqual(externalGameValidationErrors(game),[]);
});

test('reconnaît et prépare les ressources Wordwall, vidéo et autres services',()=>{
  assert.equal(providerFromExternalGameUrl('https://wordwall.net/fr/embed/demo'),'wordwall');
  assert.equal(providerFromExternalGameUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),'youtube');
  assert.equal(providerFromExternalGameUrl('https://vimeo.com/76979871'),'vimeo');
  assert.equal(providerFromExternalGameUrl('https://view.genially.com/demo'),'genially');
  assert.equal(providerFromExternalGameUrl('https://learningapps.org/view123'),'learningapps');
  assert.equal(providerFromExternalGameUrl('https://www.canva.com/design/demo/view'),'canva');
  assert.equal(providerFromExternalGameUrl('https://example.org/support.pdf'),'document');
  assert.equal(providerFromExternalGameUrl('https://example.org/activity'),'other');
  assert.equal(externalResourceEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(externalResourceEmbedUrl('https://vimeo.com/76979871'),'https://player.vimeo.com/video/76979871');
  assert.equal(externalResourceEmbedUrl('https://wordwall.net/fr/resource/12345/mon-quiz'),'');
  assert.equal(externalResourceEmbedUrl('https://wordwall.net/fr/embed/demo'),'https://wordwall.net/fr/embed/demo');
  assert.equal(wordwallEmbedFromOEmbedHtml('<iframe src="https://wordwall.net/fr/embed/demo?themeId=1"></iframe>'),'https://wordwall.net/fr/embed/demo?themeId=1');
});

test('conserve une mise en situation générée à partir de la ressource',()=>{
  const resource=normalizeExternalGameContent({sourceUrl:'https://wordwall.net/fr/embed/demo',scenario:{title:'Accueil difficile',context:'Un visiteur conteste une consigne.',aiRole:'Visiteur',learnerRole:'Agent',mission:'Répondre avec calme.',prompts:['Accueillez le visiteur.']}});
  assert.equal(resource.scenario.title,'Accueil difficile');
  assert.deepEqual(resource.scenario.prompts,['Accueillez le visiteur.']);
});

test('conserve les livrables choisis et les appuis fournis',()=>{
  const resource=normalizeExternalGameContent({
    sourceUrl:'https://learningapps.org/view123',
    supportText:'Consigne et contenu pédagogique fournis par le formateur.',
    supportFileIds:['capture_12345678'],
    selectedOutputs:['course','quiz','pdf','quiz','unknown'],
  });
  assert.equal(resource.provider,'learningapps');
  assert.equal(resource.htmlSourceName,'');
  assert.deepEqual(resource.selectedOutputs,['course','quiz','pdf']);
  assert.deepEqual(resource.supportFileIds,['capture_12345678']);
});

test('exige un lien valide et au moins une version papier',()=>{
  assert.deepEqual(externalGameValidationErrors({embedUrl:'javascript:alert(1)',paper:{learnerVersion:false,trainerVersion:false}}),[
    'La ressource externe nécessite un lien HTTPS ou un code iframe valide.',
    'Choisissez au moins une version papier : apprenant ou formateur.',
  ]);
});
