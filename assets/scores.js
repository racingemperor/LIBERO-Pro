// Published summaries are already rounded in the paper. Keep the underlying
// evaluation rates intact for task/suite details and cross-setting aggregation.
export const baseScore = model => model.reportedScores?.base ?? model.scores.base;

export function summaryScore(model, mode) {
  return model.reportedScores?.[mode] ?? model.scores[mode];
}

export function deltaScore(model, scores) {
  if (Number.isFinite(scores.delta)) return scores.delta;
  const base = baseScore(model);
  return Number.isFinite(base) && Number.isFinite(scores.average) ? scores.average - base : null;
}
