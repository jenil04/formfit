/**
 * Deterministic claim check. A "claim" is a sentence that says something was
 * built / shipped / launched / integrated. It is backed when its content
 * keywords overlap an evidence title or a bank entry. The LLM only judges the
 * sentences this pre-check cannot clear, and may only cite sources that exist
 * and share at least one keyword with the sentence.
 */
import type { Citation, ClaimResult, EvidenceKind } from "./types.js";

export interface EvidenceSource {
  id: string;
  kind: EvidenceKind;
  title: string;
  url?: string | null;
  sha?: string | null;
  date?: string | null;
}

export interface BankSource {
  id: string;
  topic: string;
  /** One sentence or one "key: value" fact. Matching is per source, so give one source per sentence. */
  text: string;
}

const CLAIM_VERB_RE =
  /\b(built|build|builds|shipp?ed|ships|launch(?:ed|es)?|integrat(?:ed|es)|releas(?:ed|es)|deploy(?:ed|s)|implement(?:ed|s)|creat(?:ed|es)|develop(?:ed|s)|open[- ]sourced|rolled out|migrat(?:ed|es)|publish(?:ed|es)|deliver(?:ed|s)|added|introduc(?:ed|es)|wrote|written|designed|completed|connected|automated|supports?|runs on|powered by)\b/i;

const STOPWORDS = new Set(
  `a an the and or but of to in on for with by from at as is are was were be been being it its this that these those
we our us i my you your they their he she his her them there here then than so such very more most also just now
new first second last next recent recently already still only own both each every all any some many few other
have has had having do does did done not no can could will would should may might which who whom what when where why how
over under into out up down off about across after before during through while per via using use used
feature features users user product app application system platform tool tools thing things work works working
support supports way ways one two three four five`.split(/\s+/),
);

/** Strip a plural / tense ending so "pilots" matches "pilot" and "integrated" matches "integration". */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 6 && /(ation|ations)$/.test(w)) w = w.replace(/ations?$/, "");
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss"))
    w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

function tokens(text: string): string[] {
  return (
    text.toLowerCase().match(/[a-z0-9][a-z0-9+#.\-_]*[a-z0-9+#]|[a-z0-9]/g) ??
    []
  )
    .map((t) => t.replace(/[.\-_]+$/, ""))
    .filter(Boolean);
}

/** Content keywords of a sentence: no stopwords, no claim verbs, stemmed, de-duplicated. */
export function keywords(text: string): string[] {
  const out = new Set<string>();
  for (const t of tokens(text)) {
    if (STOPWORDS.has(t) || CLAIM_VERB_RE.test(t) || t.length < 2) continue;
    if (/^\d+$/.test(t) && t.length < 3) continue;
    out.add(stem(t));
  }
  return [...out];
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasClaimVerb(sentence: string): boolean {
  return CLAIM_VERB_RE.test(sentence);
}

/** "integrated Stripe payments": the claim verb plus the next few words, for the amber reason. */
export function claimPhrase(sentence: string): string {
  const m = CLAIM_VERB_RE.exec(sentence);
  if (!m) return sentence.slice(0, 40);
  const rest = sentence
    .slice(m.index)
    .split(/[,;:.!?]/)[0]!
    .split(/\s+/)
    .slice(0, 4);
  while (rest.length > 1 && STOPWORDS.has(rest[rest.length - 1]!.toLowerCase()))
    rest.pop();
  return rest.join(" ");
}

export function normalizeSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();
}

export function evidenceLabel(e: EvidenceSource): string {
  if (e.kind === "commit") return e.sha ? e.sha : "commit";
  if (e.kind === "pr") return `PR ${e.sha ?? ""}`.trim();
  return e.title.length > 28 ? `${e.title.slice(0, 27)}…` : e.title;
}

export function evidenceCitation(e: EvidenceSource): Citation {
  return {
    kind: e.kind,
    id: e.id,
    label: evidenceLabel(e),
    ...(e.url ? { url: e.url } : {}),
  };
}

interface Scored {
  citation: Citation;
  overlap: number;
}

function score(kw: string[], haystack: Set<string>): number {
  let n = 0;
  for (const k of kw) if (haystack.has(k)) n += 1;
  return n;
}

export type Strength = "strong" | "weak" | "none";

export interface ClaimCandidate {
  sentence: string;
  strength: Strength;
  /** best-first sources that share keywords with the sentence */
  matches: Scored[];
  keywords: string[];
}

export interface CheckInput {
  text: string;
  evidence: EvidenceSource[];
  bank: BankSource[];
  /** Citations the user attached to a specific sentence. */
  attachments?: Citation[];
  /** Source ids the drafting model cited; a weak match to one of them counts as backed. */
  modelCited?: string[];
}

function strengthOf(kw: string[], overlap: number): Strength {
  if (overlap === 0) return "none";
  if (kw.length === 1) return "strong";
  if (overlap >= 2 && overlap / kw.length >= 0.6) return "strong";
  return "weak";
}

/** Pure, LLM-free pass. Returns every claim sentence with how well it is backed. */
export function analyzeClaims(input: CheckInput): ClaimCandidate[] {
  const evSets = input.evidence.map((e) => ({
    e,
    set: new Set(keywords(e.title)),
  }));
  const bankSets = input.bank.map((b) => ({
    b,
    set: new Set(keywords(b.text)),
  }));
  const out: ClaimCandidate[] = [];
  for (const sentence of splitSentences(input.text)) {
    if (!hasClaimVerb(sentence)) continue;
    const kw = keywords(sentence);
    if (kw.length === 0) continue; // nothing specific to verify
    const matches: Scored[] = [];
    for (const { e, set } of evSets) {
      const overlap = score(kw, set);
      if (overlap > 0) matches.push({ citation: evidenceCitation(e), overlap });
    }
    for (const { b, set } of bankSets) {
      const overlap = score(kw, set);
      if (overlap > 0)
        matches.push({
          citation: { kind: "bank", id: b.id, label: b.topic },
          overlap,
        });
    }
    matches.sort((a, b) => b.overlap - a.overlap);
    // One bank entry can match through several of its sentences; keep its best.
    const seen = new Set<string>();
    const unique = matches.filter((m) => {
      const key = `${m.citation.kind}:${m.citation.id}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
    matches.length = 0;
    matches.push(...unique);
    out.push({
      sentence,
      keywords: kw,
      matches,
      strength: strengthOf(kw, matches[0]?.overlap ?? 0),
    });
  }
  return out;
}

export function unsupportedReason(sentence: string): string {
  return `No commit or bank fact backs '${claimPhrase(sentence)}'`;
}

/** Deterministic verdict for one candidate. Weak matches stay unsupported until the LLM (or the user) vouches. */
export function deterministicResult(
  c: ClaimCandidate,
  attachments: Citation[] = [],
  modelCited: string[] = [],
): ClaimResult {
  const norm = normalizeSentence(c.sentence);
  const attached = attachments.filter(
    (a) => a.sentence && normalizeSentence(a.sentence) === norm,
  );
  if (attached.length)
    return {
      sentence: c.sentence,
      supported: true,
      citations: attached,
      judged: "user",
    };
  if (c.strength === "strong")
    return {
      sentence: c.sentence,
      supported: true,
      citations: c.matches.slice(0, 2).map((m) => m.citation),
      judged: "deterministic",
    };
  const cited = c.matches.filter((m) => modelCited.includes(m.citation.id));
  if (cited.length)
    return {
      sentence: c.sentence,
      supported: true,
      citations: cited.slice(0, 2).map((m) => m.citation),
      judged: "llm",
    };
  return {
    sentence: c.sentence,
    supported: false,
    citations: [],
    reason: unsupportedReason(c.sentence),
    suggestions: c.matches.slice(0, 3).map((m) => m.citation),
    judged: "deterministic",
  };
}

export function checkClaimsDeterministic(input: CheckInput): ClaimResult[] {
  return analyzeClaims(input).map((c) =>
    deterministicResult(c, input.attachments, input.modelCited),
  );
}

/** Remove a sentence from an answer (fallback for "Fix" when the model is unavailable). */
export function removeSentence(text: string, sentence: string): string {
  const norm = normalizeSentence(sentence);
  return splitSentences(text)
    .filter((s) => normalizeSentence(s) !== norm)
    .join(" ")
    .trim();
}
