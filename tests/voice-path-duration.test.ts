import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_VOICE_SESSION_DURATION_SECONDS, normalizeVoiceSessionDurationSeconds, VOICE_SESSION_DURATION_MINUTES } from '../lib/voice-session-duration.ts';

const management = readFileSync(new URL('../components/learner-management-view.tsx', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../components/learner-portal.tsx', import.meta.url), 'utf8');
const coach = readFileSync(new URL('../components/voice-coach.tsx', import.meta.url), 'utf8');
const sessionRoute = readFileSync(new URL('../app/api/voice-coach/session/route.ts', import.meta.url), 'utf8');

test('propose les durées vocales attendues et refuse une valeur libre', () => {
  assert.deepEqual(VOICE_SESSION_DURATION_MINUTES, [2, 3, 4, 5, 6, 10, 15, 20]);
  for (const minutes of VOICE_SESSION_DURATION_MINUTES) assert.equal(normalizeVoiceSessionDurationSeconds(minutes * 60), minutes * 60);
  assert.equal(normalizeVoiceSessionDurationSeconds(7 * 60), DEFAULT_VOICE_SESSION_DURATION_SECONDS);
  assert.equal(normalizeVoiceSessionDurationSeconds('invalide'), DEFAULT_VOICE_SESSION_DURATION_SECONDS);
});

test('le formateur choisit une durée prédéfinie lors de l’attribution du parcours', () => {
  assert.match(management, /Durée maximale de chaque séance vocale<select/);
  assert.match(management, /VOICE_SESSION_DURATION_MINUTES\.map/);
  assert.doesNotMatch(management, /id=\{`voice-\$\{learner\.id\}`\} type="number"/);
});

test('le parcours transmet son attribution et sa limite au chronomètre apprenant', () => {
  assert.match(portal, /assignmentId:playing\.assignment\.id/);
  assert.match(portal, /voiceMaxDurationSeconds:playing\.assignment\.voiceDurationSeconds/);
  assert.match(portal, /Séance vocale · \$\{Math\.round\(assignment\.voiceDurationSeconds\/60\)\} min maximum/);
  assert.match(coach, /assignmentId:journey\?\.assignmentId/);
  assert.match(coach, /initialSessionSeconds/);
  assert.match(coach, /se termine automatiquement à zéro/);
});

test('le serveur rattache la séance à l’attribution exacte avant de calculer la limite', () => {
  assert.match(sessionRoute, /eq\(learnerAssignments\.id,assignmentId\)/);
  assert.match(sessionRoute, /VOICE_ASSIGNMENT_REQUIRED/);
  assert.match(sessionRoute, /maximumSeconds:row\.assignment\.voiceDurationSeconds/);
  assert.match(sessionRoute, /assignmentId:access\.assignmentId/);
});
