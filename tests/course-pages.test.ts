import assert from 'node:assert/strict';
import test from 'node:test';
import { coursePagesFromContent, coursePagesJsonSchema, normalizeCoursePages, resolveCoursePageCount, stabilizeCoursePages, validateCoursePages, type CoursePage } from '../lib/course-pages.ts';

test('résout les quatre longueurs de cours et borne le nombre personnalisé',()=>{
  assert.equal(resolveCoursePageCount('short',99),4);
  assert.equal(resolveCoursePageCount('intermediate',99),7);
  assert.equal(resolveCoursePageCount('complete',99),12);
  assert.equal(resolveCoursePageCount('custom',2),4);
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

test('remet automatiquement la couverture, l’introduction et la synthèse dans le bon ordre',()=>{
  const filler='Une explication professionnelle précise, progressive et directement applicable sur le terrain. '.repeat(15);
  const raw=[
    {id:'chapitre',title:'Comprendre',kind:'chapter',lead:filler,sections:[{heading:'Notion',body:filler}],definitions:[],examples:[],keyPoints:['Point'],practice:{title:'Application',instructions:'Répondre.'},sourceRefs:[{documentId:'doc',pageNumber:1}]},
    {id:'couverture',title:'Le cours',kind:'cover',lead:filler,sections:[],definitions:[],examples:[],keyPoints:[],practice:{title:'',instructions:''},sourceRefs:[]},
    {id:'exercice',title:'S’entraîner',kind:'exercises',lead:filler,sections:[],definitions:[],examples:[],keyPoints:['Point'],practice:{title:'Application',instructions:'Répondre.'},sourceRefs:[]},
    {id:'introduction',title:'Bienvenue',kind:'introduction',lead:filler,sections:[],definitions:[],examples:[],keyPoints:['Objectif'],practice:{title:'',instructions:''},sourceRefs:[]},
    {id:'chapitre-2',title:'Appliquer',kind:'chapter',lead:filler,sections:[{heading:'Méthode',body:filler}],definitions:[],examples:[],keyPoints:['Point'],practice:{title:'Application',instructions:'Répondre.'},sourceRefs:[]},
    {id:'synthese',title:'À retenir',kind:'synthesis',lead:filler,sections:[],definitions:[],examples:[],keyPoints:['Point'],practice:{title:'Bilan',instructions:'Expliquer.'},sourceRefs:[]},
    {id:'chapitre-3',title:'Contrôler',kind:'chapter',lead:filler,sections:[{heading:'Contrôle',body:filler}],definitions:[],examples:[],keyPoints:['Point'],practice:{title:'Application',instructions:'Répondre.'},sourceRefs:[]},
  ];
  const pages=stabilizeCoursePages(raw,7,new Set(['doc:1','doc:2']));
  assert.deepEqual(pages.map((page)=>page.kind),['cover','introduction','chapter','chapter','chapter','exercises','synthesis']);
  assert.ok(pages.some((page)=>page.sourceRefs.some((source)=>source.documentId==='doc'&&source.pageNumber===2)));
  assert.equal(validateCoursePages(pages,7,'intermediate',new Set(['doc:1','doc:2'])),null);
});

test('corrige un simple mauvais libellé sur la deuxième page sans rejeter le cours',()=>{
  const filler='Une explication professionnelle précise, progressive et directement applicable sur le terrain. '.repeat(15);
  const raw=['cover','chapter','chapter','chapter','chapter','exercises','synthesis'].map((kind,index)=>({id:`page-${index+1}`,title:`Partie ${index+1}`,kind,lead:filler,sections:kind==='chapter'?[{heading:'Comprendre',body:filler}]:[],definitions:[],examples:[],keyPoints:['Point essentiel'],practice:{title:'Application',instructions:'Expliquer la conduite à tenir.'},sourceRefs:[{documentId:'doc',pageNumber:1}]}));
  const pages=stabilizeCoursePages(raw,7,new Set(['doc:1']));
  assert.equal(pages[1]?.kind,'introduction');
  assert.equal(validateCoursePages(pages,7,'intermediate',new Set(['doc:1'])),null);
});
