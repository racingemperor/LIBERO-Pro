// The release paper is authoritative for published summary values.
// Keep the original evaluation rates available for detailed results and aggregation.
export const baseScore = model => model.reportedScores?.base ?? model.scores.base;
export const summaryScore = (model, mode) => model.reportedScores?.[mode] ?? model.scores[mode];
export function deltaScore(model, mode) {
  const reported = model.reportedScores?.[mode]?.delta;
  if (Number.isFinite(reported)) return reported;
  const average = mode === 'overall' ? model.scores.overall : summaryScore(model, mode).average;
  const base = baseScore(model);
  return Number.isFinite(average) && Number.isFinite(base) ? average - base : null;
}
