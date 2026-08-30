import assert from 'node:assert/strict';
import test from 'node:test';
import { coursePagesFromContent, coursePagesJsonSchema, normalizeCoursePages, resolveCoursePageCount, validateCoursePages, type CoursePage } from '../lib/course-pages.ts';

test('résout les quatre longueurs de cours et borne le nombre personnalisé',()=>{
  assert.equal(resolveCoursePageCount('short',99),4);
  assert.equal(resolveCoursePageCount('intermediate',99),7);
  assert.equal(resolveCoursePageCount('complete',99),12);
  assert.equal(resolveCoursePageCount('custom',2),3);
  assert.equal(resolveCoursePageCount('custom',50),24);
});

test('normalise et extrait les pages du contenu enregistré',()=>{
  const pages=coursePagesFromContent({coursePages:[{id:'introduction générale',title:'Bienvenue',kind:'introduction',sections:[],definitions:[],examples:[],keyPoints:['Comprendre'],practice:{title:'Question',instructions:'Répondre'},sourceRefs:[{documentId:'doc',pageNumber:1}]}]});
  assert.equal(pages.length,1);
  assert.equal(pages[0]?.id,'introduction-g-n-rale');
  assert.equal(pages[0]?.sourceRefs[0]?.pageNumber,1);
});

test('le schéma impose exactement le nombre de pages demandé',()=>{
  const schema=coursePagesJsonSchema(12);
  assert.equal(schema.minItems,12);
  assert.equal(schema.maxItems,12);
});

test('valide un vrai cours structuré couvrant toutes les pages sources',()=>{
  const filler='Une explication professionnelle précise, progressive et directement applicable sur le terrain. '.repeat(15);
  const kinds:CoursePage['kind'][]=['cover','introduction','chapter','chapter','chapter','exercises','synthesis'];
  const raw=kinds.map((kind,index)=>({id:`page-${index+1}`,title:`Partie ${index+1}`,kind,lead:filler,sections:kind==='chapter'?[{heading:'Comprendre',body:filler}]:[],definitions:[],examples:[],keyPoints:['Point essentiel'],practice:{title:'Application',instructions:'Expliquer la conduite à tenir.'},sourceRefs:[{documentId:'doc',pageNumber:index<3?index+1:1}]}));
  const pages=normalizeCoursePages(raw);
  assert.equal(validateCoursePages(pages,7,'intermediate',new Set(['doc:1','doc:2','doc:3'])),null);
  assert.match(validateCoursePages(pages.slice(0,6),7,'intermediate',new Set())??'',/6 page/);
  assert.match(validateCoursePages(pages,7,'intermediate',new Set(['doc:1','doc:2','doc:3','doc:4']))??'',/toutes les pages/);
});
