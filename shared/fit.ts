import type { Limits } from "./types";

/** Character count as a web form's maxlength sees it: UTF-16 units, LF newlines. */
export function countChars(text: string): number {
  return text.replace(/\r\n/g, "\n").length;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export interface Measure {
  chars: number;
  words: number;
  over: boolean;
  /** 0..n, usage against the binding limit (chars preferred), null if unlimited. */
  ratio: number | null;
  tone: "ok" | "near" | "over" | "none";
}

export function measure(text: string, limits: Limits): Measure {
  const chars = countChars(text);
  const words = countWords(text);
  const charLimit = limits.charLimit ?? null;
  const wordLimit = limits.wordLimit ?? null;
  const overChars = charLimit != null && chars > charLimit;
  const overWords = wordLimit != null && words > wordLimit;
  const ratio =
    charLimit != null
      ? chars / charLimit
      : wordLimit != null
        ? words / wordLimit
        : null;
  const over = overChars || overWords;
  const tone = over
    ? "over"
    : ratio == null
      ? "none"
      : ratio >= 0.9
        ? "near"
        : "ok";
  return { chars, words, over, ratio, tone };
}

export function fitsLimits(text: string, limits: Limits): boolean {
  return !measure(text, limits).over;
}

/** The length we ask the model to aim for, leaving a little headroom. */
export function targetChars(limits: Limits): number | null {
  if (limits.charLimit != null) {
    return Math.max(10, Math.floor(limits.charLimit * 0.92));
  }
  return null;
}

export function targetWords(limits: Limits): number | null {
  if (limits.wordLimit != null) {
    return Math.max(3, Math.floor(limits.wordLimit * 0.92));
  }
  return null;
}

/**
 * Last-resort deterministic trim: cut at the last sentence end that fits,
 * else the last word boundary, so we never exceed the limit and never
 * leave a dangling half word.
 */
export function hardTrim(text: string, limits: Limits): string {
  let out = text.replace(/\r\n/g, "\n").trim();
  if (limits.wordLimit != null && countWords(out) > limits.wordLimit) {
    out = out.split(/\s+/).slice(0, limits.wordLimit).join(" ");
  }
  const limit = limits.charLimit;
  if (limit == null || out.length <= limit) return out;
  const window = out.slice(0, limit);
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (sentenceEnd >= limit * 0.5)
    return window.slice(0, sentenceEnd + 1).trim();
  if (/[.!?]$/.test(window) && window.length <= limit) {
    // window ended exactly on a sentence terminator
    return window.trim();
  }
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.5 ? window.slice(0, lastSpace) : window;
  return cut.replace(/[\s,;:–—-]+$/, "").trim();
}

export interface FitResult {
  text: string;
  attempts: number;
  trimmed: boolean;
}

/**
 * Ask `refit` to shorten until the text fits, then hard-trim as a backstop.
 * `refit` receives the over-length text and the measured overage.
 * The returned text NEVER exceeds the limits.
 */
export async function fitToLimits(
  initial: string,
  limits: Limits,
  refit: (current: string, m: Measure) => Promise<string>,
  maxAttempts = 2,
): Promise<FitResult> {
  let text = initial.trim();
  let attempts = 0;
  while (measure(text, limits).over && attempts < maxAttempts) {
    attempts += 1;
    try {
      const next = (await refit(text, measure(text, limits))).trim();
      if (next) text = next;
    } catch {
      break;
    }
  }
  if (measure(text, limits).over) {
    return { text: hardTrim(text, limits), attempts, trimmed: true };
  }
  return { text, attempts, trimmed: false };
}
