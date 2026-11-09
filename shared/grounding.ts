/**
 * Deterministic guardrail: every figure in a draft must exist in the bank.
 * We extract numeric values (handling $, commas, k/m/b suffixes, %) from the
 * draft and require each to be present among the values extracted from the
 * bank text the draft is allowed to use.
 */

const NUMBER_RE =
  /(?<![\w.])[$€£₹]?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(k|m|bn|b|x|%|million|billion|thousand)?(?![\w])/gi;

const MULTIPLIER: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const whole = m[1].replace(/,/g, "");
    const frac = m[2] ?? "";
    let value = Number(whole + frac);
    const suffix = (m[3] ?? "").toLowerCase();
    if (MULTIPLIER[suffix]) value *= MULTIPLIER[suffix];
    if (Number.isFinite(value)) out.push(Math.round(value * 1e6) / 1e6);
  }
  return out;
}

/**
 * Returns the figures (as written in `answer`) that don't appear in `corpus`.
 * `allow` lists numbers always permitted (e.g. the field's own limit).
 */
export function findUngroundedNumbers(
  answer: string,
  corpus: string,
  allow: number[] = [],
): string[] {
  const known = new Set<number>([...extractNumbers(corpus), ...allow]);
  const ungrounded: string[] = [];
  for (const m of answer.matchAll(NUMBER_RE)) {
    const whole = m[1].replace(/,/g, "");
    const frac = m[2] ?? "";
    let value = Number(whole + frac);
    const suffix = (m[3] ?? "").toLowerCase();
    if (MULTIPLIER[suffix]) value *= MULTIPLIER[suffix];
    value = Math.round(value * 1e6) / 1e6;
    if (!known.has(value)) ungrounded.push(m[0].trim());
  }
  return [...new Set(ungrounded)];
}
