import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCourseImagePrompt, normalizeCourseImages, resolveAutomaticPlacement, withCourseImages } from '../lib/course-images.ts';

test('normalise les métadonnées sans accepter des chemins incomplets', () => {
  const images = normalizeCourseImages([
    {id:'img-1',objectKey:'trainers/u/course-images/a.png',placement:'procedure',style:'pedagogical',fit:'cover',focalX:120,focalY:-2,status:'validated'},
    {id:'invalide'},
  ]);
  assert.equal(images.length,1);
  assert.equal(images[0]?.placement,'procedure');
  assert.equal(images[0]?.focalX,100);
  assert.equal(images[0]?.focalY,0);
  assert.equal(images[0]?.status,'validated');
  assert.equal(images[0]?.sourcePage,undefined);
});

test('choisit une place pédagogique selon la mécanique', () => {
  assert.equal(resolveAutomaticPlacement('scenario',0),'cover');
  assert.equal(resolveAutomaticPlacement('scenario',1),'scenario');
  assert.equal(resolveAutomaticPlacement('drag-drop',1),'procedure');
  assert.equal(resolveAutomaticPlacement('quiz',1),'explanation');
});

test('la consigne inspirée interdit explicitement la copie', () => {
  const prompt = buildCourseImagePrompt({title:'Le bionettoyage',placement:'example',style:'illustration',inspiredByDocument:true});
  assert.match(prompt,/entièrement originaux/);
  assert.match(prompt,/Ne copie ni la mise en page/);
});

test('préserve le contenu existant lors de l’ajout des images', () => {
  const content = withCourseImages({questions:[{question:'Test'}]},normalizeCourseImages([{id:'i',objectKey:'k'}]));
  assert.deepEqual(content.questions,[{question:'Test'}]);
  assert.equal(Array.isArray(content.courseImages),true);
});
