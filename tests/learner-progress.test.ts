import assert from 'node:assert/strict';
import test from 'node:test';
import { isFinishedProgress, unlocksNextActivity } from '../lib/learner-progress.ts';

test('une activité remise au formateur déverrouille immédiatement la suivante', () => {
  assert.equal(isFinishedProgress({ status:'submitted' }), true);
  assert.equal(unlocksNextActivity({ status:'submitted' }, 80), true);
  assert.equal(unlocksNextActivity({ status:'reviewing' }, 80), true);
});

test('une activité notée terminée respecte le score minimum', () => {
  assert.equal(unlocksNextActivity({ status:'completed',score:7,maxScore:10 }, 70), true);
  assert.equal(unlocksNextActivity({ status:'completed',score:6,maxScore:10 }, 70), false);
  assert.equal(unlocksNextActivity({ status:'in_progress',score:10,maxScore:10 }, 0), false);
});
