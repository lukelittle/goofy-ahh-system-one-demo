/**
 * Small, honest derivations from the probabilities the model returns.
 *
 * The API returns probabilities, not the head's raw logits. Softmax is
 * invariant to adding a constant, so from p_i we can recover
 *   log p_i = logit_i / T - logsumexp(logit / T)
 * i.e. each option's temperature-scaled score up to one shared constant.
 * That is what Nerd Mode shows as the "score" column; it is derived, not a
 * separate model output.
 */

export function logScores(probs: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, p] of Object.entries(probs)) out[k] = Math.log(Math.max(p, 1e-12));
  return out;
}

/** 1 - H(p) / log N, the same definition the server uses for `confidence`. */
export function normalizedConfidence(probs: number[]): number {
  const n = probs.length;
  if (n < 2) return 1;
  const h = -probs.reduce((acc, p) => (p > 0 ? acc + p * Math.log(p) : acc), 0);
  return Math.min(1, Math.max(0, 1 - h / Math.log(n)));
}

export function sortedEntries(probs: Record<string, number>): [string, number][] {
  return Object.entries(probs).sort((a, b) => b[1] - a[1]);
}

export function pct(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`;
}
