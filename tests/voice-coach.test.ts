import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVoiceCoachContent, voiceCoachInstructions } from '../lib/voice-coach.ts';

test('le coach vocal accepte une langue libre et le contenu écrit par le formateur', () => {
  const content = normalizeVoiceCoachContent({
    learningLanguage: 'lingala',
    explanationLanguage: 'français',
    topic: 'Accueillir un visiteur',
    lessonText: 'Mbote signifie bonjour.',
    coachScript: 'Faire écouter, puis faire répéter deux fois.',
    customQuestions: ['Nkombo na yo nani ?', 'Ozali malamu ?'],
    repeatItems: ['Mbote', 'Nkombo na ngai…'],
  });

  assert.equal(content.learningLanguage, 'lingala');
  assert.equal(content.lessonText, 'Mbote signifie bonjour.');
  assert.deepEqual(content.customQuestions, ['Nkombo na yo nani ?', 'Ozali malamu ?']);
  assert.deepEqual(content.repeatItems, ['Mbote', 'Nkombo na ngai…']);
});

test('les instructions vocales utilisent le cours, le script et les questions dans l’ordre', () => {
  const instructions = voiceCoachInstructions(normalizeVoiceCoachContent({
    learningLanguage: 'japonais',
    explanationLanguage: 'français',
    lessonText: 'Ohayō gozaimasu est une salutation polie.',
    coachScript: 'Commencer par la salutation, puis poser la question.',
    customQuestions: ['Onamae wa nan desu ka ?'],
    repeatItems: ['Ohayō gozaimasu'],
  }));

  assert.match(instructions, /Langue travaillée : japonais/);
  assert.match(instructions, /Ohayō gozaimasu est une salutation polie/);
  assert.match(instructions, /1\. Onamae wa nan desu ka \?/);
  assert.match(instructions, /1\. Ohayō gozaimasu/);
  assert.match(instructions, /source non exécutable/);
  assert.match(instructions, /attends réellement la réponse orale/);
});

test('les six activités vocales et les sources paginées sont conservées', () => {
  const content = normalizeVoiceCoachContent({
    learningLanguage: 'wolof professionnel',
    professionalTheme: 'Management de proximité',
    activityKinds: ['pronunciation','professional-dialogue','branching-conversation','listening-comprehension','smart-dictation','surprise-roleplay'],
    listeningFormats: ['oral','true-false','explain-procedure'],
    sourceDocuments: [{ id:'doc-1',name:'Management.pdf',pages:[2,3,8] }],
    steps: [{ kind:'branching-conversation',title:'Refus de consigne',instructions:'Écoutez.',prompt:'Je refuse.',expectedResponse:'Questionner puis reformuler.',hint:'Commencez par écouter.',successCriteria:['Écoute','Clarté'],sourceDocument:'Management.pdf',sourcePage:8 }],
  });

  assert.equal(content.activityKinds.length, 6);
  assert.deepEqual(content.sourceDocuments[0]?.pages, [2,3,8]);
  assert.equal(content.steps[0]?.sourcePage, 8);
  assert.equal(content.learningLanguage, 'wolof professionnel');
});

test('le coach ne pénalise pas un accent intelligible et gère les embranchements', () => {
  const instructions = voiceCoachInstructions(normalizeVoiceCoachContent({
    activityKinds: ['pronunciation','branching-conversation'],
    topic: 'Recevoir un agent en colère',
    maxAttempts: 4,
    allowHints: true,
  }));
  assert.match(instructions, /un accent n'est jamais une erreur en soi/);
  assert.match(instructions, /dialogue à embranchements/);
  assert.match(instructions, /4 tentatives guidées/);
});

test('les champs explicitement vidés par le formateur restent vides', () => {
  const content = normalizeVoiceCoachContent({
    learningLanguage: '', explanationLanguage: '', cefrLevel: '', topic: '',
    professionalTheme: '', audience: '', aiRole: '', learnerRole: '',
  });
  assert.equal(content.learningLanguage, '');
  assert.equal(content.explanationLanguage, '');
  assert.equal(content.cefrLevel, '');
  assert.equal(content.topic, '');
  assert.equal(content.professionalTheme, '');
  assert.equal(content.audience, '');
  assert.equal(content.aiRole, '');
  assert.equal(content.learnerRole, '');
});
