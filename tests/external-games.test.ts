import test from 'node:test';
import assert from 'node:assert/strict';
import { externalGameValidationErrors, extractExternalGameUrl, normalizeExternalGameContent, providerFromExternalGameUrl } from '../lib/external-games.ts';

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

test('normalise le contenu papier et n’invente pas de score',()=>{
  const game=normalizeExternalGameContent({embedUrl:'https://example.org/game',scoreMode:'manual_completion',paper:{learnerVersion:true,trainerVersion:false,questions:[{question:'Pourquoi ?',answer:'Parce que.'}]}});
  assert.equal(game.embedUrl,'https://example.org/game');
  assert.equal(game.scoreMode,'manual_completion');
  assert.deepEqual(game.paper.questions,[{question:'Pourquoi ?',answer:'Parce que.'}]);
  assert.deepEqual(externalGameValidationErrors(game),[]);
});

test('exige un lien valide et au moins une version papier',()=>{
  assert.deepEqual(externalGameValidationErrors({embedUrl:'javascript:alert(1)',paper:{learnerVersion:false,trainerVersion:false}}),[
    'Le jeu externe nécessite un lien HTTPS ou un code iframe valide.',
    'Choisissez au moins une version papier : apprenant ou formateur.',
  ]);
});
