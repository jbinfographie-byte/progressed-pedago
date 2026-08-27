import assert from 'node:assert/strict';
import test from 'node:test';
import { createPowerPoint, safePresentationFilename } from '../lib/pptx.ts';

test('construit une archive PowerPoint contenant les éléments Office essentiels', () => {
  const file = createPowerPoint({title:'Prévenir les risques',subtitle:'Formation professionnelle',slides:[{title:'Le risque doit être repéré avant l’action',subtitle:'Observer avant d’intervenir',bullets:['Identifier la situation','Choisir la protection adaptée']},{title:'La méthode sécurise chaque étape',subtitle:'Appliquer dans l’ordre',bullets:['Préparer','Baliser','Contrôler']}],sources:['Source interne']});
  assert.equal(file[0],0x50); assert.equal(file[1],0x4b);
  const contents = new TextDecoder().decode(file);
  assert.match(contents,/\[Content_Types\]\.xml/);
  assert.match(contents,/ppt\/presentation\.xml/);
  assert.match(contents,/ppt\/slides\/slide4\.xml/);
  assert.match(contents,/Prévenir les risques/);
});

test('crée un nom de fichier PowerPoint portable', () => {
  assert.equal(safePresentationFilename('Sécurité & prévention'),'Securite-prevention.pptx');
});
