import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeContext, hasValidDocumentSignature, normalizeDocumentAnalysis, rankKnowledgePages, safeDocumentName, type KnowledgePageRow } from '../lib/document-knowledge.ts';

test('vérifie la signature réelle des formats importés', () => {
  assert.equal(hasValidDocumentSignature(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31]),'application/pdf'),true);
  assert.equal(hasValidDocumentSignature(new Uint8Array([0x4d,0x5a,0x90,0x00]),'application/pdf'),false);
  assert.equal(hasValidDocumentSignature(new Uint8Array([0x50,0x4b,0x03,0x04]),'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),true);
  assert.equal(hasValidDocumentSignature(new TextEncoder().encode('Support pédagogique lisible'),'text/plain'),true);
  assert.equal(hasValidDocumentSignature(new Uint8Array([0,0,0,0]),'text/plain'),false);
});

test('normalise une analyse page par page sans inventer de contenu', () => {
  const analysis = normalizeDocumentAnalysis({ pageCount:2,detectedTheme:'Prévention',summary:'Support sécurité',keywords:['EPI','EPI'],pages:[
    {pageNumber:1,title:'Équipements',summary:'Porter les EPI.',rawText:'Porter les EPI.',notions:['EPI'],procedures:['Vérifier le matériel'],risks:['Projection'],rules:[],examples:[],audiences:['Agents'],objectives:['Choisir les EPI'],level:'debutant',readingQuality:'good',warnings:[]},
    {pageNumber:2,title:'Zone floue',summary:'',rawText:'',notions:[],procedures:[],risks:[],rules:[],examples:[],audiences:[],objectives:[],level:'inconnu',readingQuality:'illegible',warnings:['Texte trop flou']},
  ]});
  assert.equal(analysis.pages.length,2);
  assert.deepEqual(analysis.keywords,['EPI']);
  assert.equal(analysis.pages[1].level,'debutant');
  assert.equal(analysis.pages[1].readingQuality,'illegible');
});

test('construit un contexte traçable avec document et page', () => {
  const context = buildKnowledgeContext([{ fileId:'doc-1',originalName:'support.pdf',pageNumber:7,title:'Procédure',summary:'Baliser la zone avant le lavage.',notionsJson:'["Balisage"]',proceduresJson:'["Poser le panneau"]',risksJson:'["Chute"]',rulesJson:'[]',examplesJson:'[]',audiencesJson:'[]',objectivesJson:'["Sécuriser la zone"]',level:'debutant',readingQuality:'partial',warningsJson:'["Bas de page flou"]',excludedInformationJson:'["Ancienne dilution"]',trainerNotes:'Utiliser le protocole interne.' }]);
  assert.match(context,/\[document:doc-1\|page:7\]/);
  assert.match(context,/Baliser la zone/);
  assert.match(context,/Ne jamais inventer le texte illisible/);
  assert.match(context,/protocole interne/);
  assert.match(context,/NE PAS UTILISER : Ancienne dilution/);
});

test('nettoie un nom de document avant stockage', () => {
  assert.equal(safeDocumentName('../Mon\u0000 support.pdf'),'..-Mon- support.pdf');
});

test('classe les pages les plus pertinentes avant la génération', () => {
  const rows:KnowledgePageRow[] = Array.from({length:45},(_,index) => ({ fileId:'doc',originalName:'cours.pdf',pageNumber:index + 1,title:index === 40 ? 'Balisage de sécurité' : `Page ${index + 1}`,summary:index === 40 ? 'Prévenir le risque de chute en zone humide.' : 'Informations générales.',notionsJson:'[]',proceduresJson:'[]',risksJson:'[]',rulesJson:'[]',examplesJson:'[]',audiencesJson:'[]',objectivesJson:'[]',level:'debutant',readingQuality:'good',warningsJson:'[]',excludedInformationJson:'[]',trainerNotes:'' }));
  const ranked = rankKnowledgePages(rows,'Comment baliser une zone humide pour éviter les chutes ?',10);
  assert.equal(ranked.some((page) => page.pageNumber === 41),true);
  assert.equal(ranked.length,10);
});
