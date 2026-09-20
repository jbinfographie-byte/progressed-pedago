export type SequenceProgress = {
  status?: string | null;
  score?: number | null;
  maxScore?: number | null;
};

const finishedStatuses = new Set(['completed', 'passed', 'submitted', 'reviewing', 'validated']);

export function isFinishedProgress(progress: SequenceProgress | null | undefined) {
  return Boolean(progress && finishedStatuses.has(String(progress.status ?? '')));
}

export function unlocksNextActivity(progress: SequenceProgress | null | undefined, minimumScore = 0) {
  if (!isFinishedProgress(progress)) return false;
  const status = String(progress?.status ?? '');
  if (status === 'submitted' || status === 'reviewing' || status === 'validated' || minimumScore <= 0) return true;
  if (progress?.score == null || !progress.maxScore) return false;
  return Math.round(progress.score / progress.maxScore * 100) >= minimumScore;
}
