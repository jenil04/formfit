import {
  analyzeClaims,
  deterministicResult,
  evidenceCitation,
  removeSentence,
  splitSentences,
  type BankSource,
  type ClaimCandidate,
  type EvidenceSource,
} from "../../../shared/claims.js";
import { findUngroundedNumbers } from "../../../shared/grounding.js";
import type { Citation, ClaimResult } from "../../../shared/types.js";
import { ask, extractJson } from "./llm.js";
import {
  getFieldDTO,
  listBank,
  listEvidence,
  patchFieldRow,
  type BankEntryDTO,
  type EvidenceDTO,
  type FieldDTO,
} from "./store.js";

export const toEvidenceSource = (e: EvidenceDTO): EvidenceSource => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  url: e.url || null,
  sha: e.sha,
  date: e.date,
});

/** Sentence-level sources: a whole entry is too broad ("restaurant owners" would back anything). */
export const toBankSources = (bank: BankEntryDTO[]): BankSource[] =>
  bank.flatMap((e) =>
    [
      ...splitSentences(e.answer),
      ...e.facts.map((f) => `${f.key}: ${f.value}`),
    ].map((text) => ({ id: e.id, topic: e.topic, text })),
  );

const JUDGE_SYSTEM = `You judge whether claim sentences in an application are backed by a founder's real shipped work.
For each numbered claim you get candidate sources (bank facts and GitHub commits/PRs/releases). A claim is supported ONLY if a candidate's text clearly says the same thing was built/shipped/launched/integrated. Topical similarity is not support; "fix dashboard crash" does not back "built a dashboard". Be strict.
Reply with one JSON object only: {"verdicts":[{"i":0,"supported":true|false,"sourceIds":["id"]}]}`;

/** Ask the model about the sentences the keyword pre-check could not clear. At most one call. */
async function judgeWithLlm(
  pending: ClaimCandidate[],
): Promise<Map<string, { ids: string[] }>> {
  const verdicts = new Map<string, { ids: string[] }>();
  if (pending.length === 0) return verdicts;
  const input = pending
    .map(
      (c, i) =>
        `CLAIM ${i}: ${c.sentence}\nCANDIDATES:\n${c.matches
          .slice(0, 6)
          .map(
            (m) =>
              `  [${m.citation.id}] ${m.citation.kind}: ${m.citation.label}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
  try {
    const raw = await ask(JUDGE_SYSTEM, input, 600);
    const parsed = extractJson<{
      verdicts?: Array<{
        i?: number;
        supported?: boolean;
        sourceIds?: string[];
      }>;
    }>(raw);
    for (const v of parsed?.verdicts ?? []) {
      const c = typeof v.i === "number" ? pending[v.i] : undefined;
      if (!c || !v.supported) continue;
      // The model may only cite sources that exist AND share a keyword with the sentence.
      const ids = (v.sourceIds ?? []).filter((id) =>
        c.matches.some((m) => m.citation.id === id),
      );
      if (ids.length) verdicts.set(c.sentence, { ids });
    }
  } catch (e) {
    console.warn(
      "[formfit] claim judgment failed, keeping deterministic verdicts:",
      e instanceof Error ? e.message : e,
    );
  }
  return verdicts;
}

export interface ClaimCheck {
  claims: ClaimResult[];
  citations: Citation[];
  llmCalls: number;
}

/** Deterministic pre-check, then (optionally) one LLM judgment for the weak ones. */
export async function checkClaimText(
  text: string,
  sources: { evidence: EvidenceSource[]; bank: BankSource[] },
  opts: {
    attachments?: Citation[] | undefined;
    modelCited?: string[] | undefined;
    useLlm?: boolean | undefined;
  } = {},
): Promise<ClaimCheck> {
  const candidates = analyzeClaims({ text, ...sources });
  const results = candidates.map((c) =>
    deterministicResult(c, opts.attachments, opts.modelCited),
  );
  let llmCalls = 0;
  if (opts.useLlm) {
    const pending = candidates.filter(
      (c, i) => !results[i]!.supported && c.strength === "weak",
    );
    if (pending.length) {
      llmCalls = 1;
      const verdicts = await judgeWithLlm(pending);
      candidates.forEach((c, i) => {
        const v = verdicts.get(c.sentence);
        if (!v) return;
        results[i] = {
          sentence: c.sentence,
          supported: true,
          citations: c.matches
            .filter((m) => v.ids.includes(m.citation.id))
            .slice(0, 2)
            .map((m) => m.citation),
          judged: "llm",
        };
      });
    }
  }
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const r of results) {
    if (!r.supported) continue;
    for (const c of r.citations) {
      if (c.kind === "bank") continue;
      const key = `${c.id}|${c.sentence ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        citations.push(c);
      }
    }
  }
  return { claims: results, citations, llmCalls };
}

/** Re-verify a saved field and persist claims + field-level citations. */
export async function refreshClaims(
  fieldId: string,
  opts: { useLlm?: boolean; extraCitations?: Citation[] } = {},
): Promise<{ field: FieldDTO; llmCalls: number }> {
  const field = (await getFieldDTO(fieldId))!;
  const [evidence, bank] = await Promise.all([listEvidence(), listBank()]);
  const attachments = [
    ...field.citations.filter((c) => c.sentence),
    ...(opts.extraCitations ?? []),
  ];
  const check = await checkClaimText(
    field.answer,
    { evidence: evidence.map(toEvidenceSource), bank: toBankSources(bank) },
    { attachments, useLlm: opts.useLlm },
  );
  const saved = await patchFieldRow(fieldId, {
    claims: JSON.stringify(check.claims),
    citations: JSON.stringify(check.citations),
  });
  return { field: saved, llmCalls: check.llmCalls };
}

export async function attachEvidence(
  fieldId: string,
  sentence: string,
  evidenceId: string,
): Promise<FieldDTO> {
  const ev = (await listEvidence()).find((e) => e.id === evidenceId);
  if (!ev) throw new Error(`Evidence ${evidenceId} not found`);
  const citation = { ...evidenceCitation(toEvidenceSource(ev)), sentence };
  return (await refreshClaims(fieldId, { extraCitations: [citation] })).field;
}

const REWRITE_SYSTEM =
  "You edit an application answer. Remove the stated claim completely and keep everything else as close to the original wording as possible. Do not add any new fact, number, name or claim. Reply with the revised answer text only.";

/** "Fix": rewrite the answer without the unsupported claim; falls back to deleting the sentence. */
export async function removeClaim(
  fieldId: string,
  sentence: string,
): Promise<{ field: FieldDTO; method: "rewrite" | "removed-sentence" }> {
  const field = (await getFieldDTO(fieldId))!;
  let next = "";
  let method: "rewrite" | "removed-sentence" = "rewrite";
  try {
    const raw = await ask(
      REWRITE_SYSTEM,
      `ANSWER:\n${field.answer}\n\nCLAIM TO REMOVE: ${sentence}`,
      900,
    );
    const cleaned = raw.trim().replace(/^["']|["']$/g, "");
    const stillThere = cleaned
      .toLowerCase()
      .includes(sentence.toLowerCase().replace(/[.!?]+$/, ""));
    const addedFigures =
      findUngroundedNumbers(cleaned, field.answer).length > 0;
    const fits =
      (field.charLimit == null || cleaned.length <= field.charLimit) &&
      cleaned.length <= field.answer.length;
    if (cleaned && !stillThere && !addedFigures && fits) next = cleaned;
  } catch (e) {
    console.warn(
      "[formfit] claim rewrite failed, deleting the sentence instead:",
      e instanceof Error ? e.message : e,
    );
  }
  if (!next) {
    next = removeSentence(field.answer, sentence);
    method = "removed-sentence";
  }
  await patchFieldRow(fieldId, {
    answer: next,
    status: next.trim()
      ? "edited"
      : field.sensitiveCategory
        ? "needs_you"
        : "empty",
  });
  return { field: (await refreshClaims(fieldId)).field, method };
}
