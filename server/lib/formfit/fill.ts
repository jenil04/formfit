import { fail } from "@agent-native/core/action";

import { classifyField } from "../../../shared/classifier.js";
import {
  fitToLimits,
  measure,
  targetChars,
  targetWords,
} from "../../../shared/fit.js";
import { findUngroundedNumbers } from "../../../shared/grounding.js";
import type { Provenance } from "../../../shared/types.js";
import { ask, extractJson } from "./llm.js";
import {
  getFieldDTO,
  listBank,
  patchFieldRow,
  type BankEntryDTO,
  type FieldDTO,
} from "./store.js";

export const GUARDRAIL_RULES = `You draft answers to application-form fields for a founder, using ONLY their "answer bank".
Hard rules:
1. Every number, date, name, URL, email and factual claim must come from the bank. Never invent, round up, estimate or imply figures. If the bank does not contain what the field asks for, return status "needs_you" with a short reason such as "No revenue figure in your bank".
2. Never answer fields about wallets, phone numbers, IDs, tax numbers, home addresses, dates of birth, bank/card details, legal consent, equity/investment terms, or references' contact details. Return "needs_you".
3. Write in the founder's voice: first person plural where natural, concrete, no hype words, no filler. Fit the length limit given; aim for the stated target.
4. For select fields the answer must be exactly one of the listed options, or "needs_you" if the bank does not make the choice clear.
5. For url/email fields the answer must be a value that appears in the bank, nothing else.
Reply with one JSON object only, no prose:
{"status":"drafted"|"needs_you","answer":"...","used":[{"entryId":"...","factKey":"optional"}],"reason":"why needs_you, or empty"}`;

function bankCorpus(bank: BankEntryDTO[]): string {
  return bank
    .map(
      (e) =>
        `${e.answer}\n${e.facts.map((f) => `${f.key}: ${f.value}`).join("\n")}`,
    )
    .join("\n");
}

function renderBank(bank: BankEntryDTO[]): string {
  return bank
    .map((e) => {
      const facts = e.facts.length
        ? `\n  facts:\n${e.facts.map((f) => `    - ${f.key}: ${f.value}`).join("\n")}`
        : "";
      return `[${e.id}] topic: ${e.topic}\n  answer: ${e.answer}${facts}`;
    })
    .join("\n\n");
}

function limitsText(field: FieldDTO, targetOverride?: number | null) {
  const parts: string[] = [];
  const tc = targetChars(field);
  const tw = targetWords(field);
  if (field.charLimit != null) {
    const target = targetOverride ? Math.min(targetOverride, tc!) : tc;
    parts.push(
      `HARD LIMIT ${field.charLimit} characters. Aim for at most ${target} characters.`,
    );
  } else if (targetOverride) {
    parts.push(`Aim for at most ${targetOverride} characters.`);
  }
  if (field.wordLimit != null) {
    parts.push(`HARD LIMIT ${field.wordLimit} words. Aim for at most ${tw}.`);
  }
  return parts.join(" ") || "No length limit; keep it concise.";
}

interface ModelDraft {
  status?: string;
  answer?: string;
  used?: Array<{ entryId?: string; factKey?: string }>;
  reason?: string;
}

export interface DraftOutcome {
  status: "drafted" | "needs_you";
  answer: string;
  provenance: Provenance[];
  reason: string | null;
  sensitiveCategory: string | null;
  trimmed: boolean;
}

const needsYou = (
  reason: string,
  sensitiveCategory: string | null = null,
): DraftOutcome => ({
  status: "needs_you",
  answer: "",
  provenance: [],
  reason,
  sensitiveCategory,
  trimmed: false,
});

function resolveProvenance(
  used: ModelDraft["used"],
  bank: BankEntryDTO[],
): Provenance[] {
  const byId = new Map(bank.map((e) => [e.id, e]));
  const out: Provenance[] = [];
  for (const u of used ?? []) {
    const entry = u.entryId ? byId.get(u.entryId) : undefined;
    if (!entry) continue;
    const factKey = entry.facts.find(
      (f) => f.key.toLowerCase() === (u.factKey ?? "").toLowerCase(),
    )?.key;
    if (!out.some((p) => p.entryId === entry.id && p.factKey === factKey)) {
      out.push({
        entryId: entry.id,
        topic: entry.topic,
        ...(factKey ? { factKey } : {}),
      });
    }
  }
  return out;
}

/** Deterministic checks a model draft must pass before we show it. Returns a problem or null. */
function validateDraft(
  field: FieldDTO,
  answer: string,
  corpus: string,
): string | null {
  const bad = findUngroundedNumbers(answer, corpus);
  if (bad.length) return `Figures not in your bank: ${bad.join(", ")}`;
  const lc = corpus.toLowerCase();
  if (field.kind === "select") {
    if (
      !field.options.some(
        (o) => o.toLowerCase() === answer.trim().toLowerCase(),
      )
    )
      return "Answer is not one of the options";
  }
  if (field.kind === "url" || field.kind === "email") {
    if (!lc.includes(answer.trim().toLowerCase()))
      return `${field.kind} not found in your bank`;
  }
  return null;
}

export async function draftField(
  field: FieldDTO,
  bank: BankEntryDTO[],
  opts: {
    instruction?: string | undefined;
    targetChars?: number | null | undefined;
  } = {},
): Promise<DraftOutcome> {
  // 1. Sensitive fields never reach the model.
  const c = classifyField(field);
  if (c.sensitive) return needsYou(c.reason!, c.category);
  if (bank.length === 0) return needsYou("Your answer bank is empty");

  const corpus = bankCorpus(bank);
  const limits = { charLimit: field.charLimit, wordLimit: field.wordLimit };
  const effective = {
    charLimit:
      opts.targetChars != null
        ? Math.min(opts.targetChars, field.charLimit ?? opts.targetChars)
        : field.charLimit,
    wordLimit: field.wordLimit,
  };

  const buildInput = (feedback?: string) =>
    `ANSWER BANK\n${renderBank(bank)}\n\nFIELD\nlabel: ${field.label}\nhelp: ${field.help || "(none)"}\nkind: ${field.kind}${
      field.options.length ? `\noptions: ${field.options.join(" | ")}` : ""
    }\nrequired: ${field.required}\nlength: ${limitsText(field, opts.targetChars)}${
      opts.instruction
        ? `\n\nINSTRUCTION FROM THE FOUNDER: ${opts.instruction}${
            field.answer ? `\nCURRENT ANSWER TO REVISE:\n${field.answer}` : ""
          }`
        : ""
    }${feedback ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${feedback}. Fix it.` : ""}`;

  let parsed: ModelDraft | null = null;
  let problem: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await ask(
      GUARDRAIL_RULES,
      buildInput(problem ?? undefined),
      1200,
    );
    parsed = extractJson<ModelDraft>(raw);
    problem = null;
    if (!parsed) {
      problem = "Reply was not valid JSON";
    } else if (parsed.status === "needs_you" || !parsed.answer?.trim()) {
      return needsYou(
        parsed.reason?.trim() || "Nothing in your bank covers this field",
      );
    } else {
      problem = validateDraft(field, parsed.answer, corpus);
    }
    if (!problem) break;
    console.warn(
      `[formfit] draft attempt ${attempt + 1} rejected for "${field.label}": ${problem}`,
    );
  }
  if (!parsed || problem) {
    return needsYou(
      problem?.startsWith("Figures")
        ? `Draft would have used figures that aren't in your bank. ${problem}`
        : "Couldn't produce a draft that passes the guardrails. Answer it yourself or add to your bank",
    );
  }

  const provenance = resolveProvenance(parsed.used, bank);
  if (provenance.length === 0) {
    return needsYou("Nothing in your bank covers this field");
  }

  // 2. Fit to the exact limit; never exceed.
  const fitted = await fitToLimits(
    (parsed.answer ?? "").trim(),
    effective,
    async (current, m) => {
      const raw = await ask(
        "You shorten text without adding any new facts, numbers or names. Reply with the shortened text only.",
        `Shorten this to at most ${targetChars(effective) ?? effective.charLimit} characters${
          effective.wordLimit ? ` and at most ${effective.wordLimit} words` : ""
        }. It is currently ${m.chars} characters.\n\n${current}`,
        600,
      );
      return raw.replace(/^["']|["']$/g, "");
    },
  );
  if (measure(fitted.text, limits).over) {
    // Unreachable (hardTrim guarantees it) but never ship an overflow.
    return needsYou("Couldn't fit this within the limit");
  }
  const finalProblem = validateDraft(field, fitted.text, corpus);
  if (finalProblem)
    return needsYou(`Draft failed a guardrail. ${finalProblem}`);

  return {
    status: "drafted",
    answer: fitted.text,
    provenance,
    reason: null,
    sensitiveCategory: null,
    trimmed: fitted.trimmed,
  };
}

export interface FillResult {
  fieldId: string;
  label: string;
  status: "drafted" | "needs_you";
  chars: number;
  limit: number | null;
  reason: string | null;
  error?: string;
}

export async function draftAndSave(
  fieldId: string,
  bank: BankEntryDTO[],
  opts: {
    instruction?: string | undefined;
    targetChars?: number | null | undefined;
  } = {},
): Promise<FillResult> {
  const field = await getFieldDTO(fieldId);
  if (!field)
    fail(`Field ${fieldId} not found`, {
      errorCode: "invalid_request",
      statusCode: 400,
    });
  const out = await draftField(field, bank, opts);
  if (out.status === "drafted") {
    await patchFieldRow(fieldId, {
      status: "drafted",
      answer: out.answer,
      draft: out.answer,
      provenance: JSON.stringify(out.provenance),
      needsReason: null,
      sensitiveCategory: null,
    });
  } else {
    // Keep a human's own answer if one exists; otherwise flag it amber.
    const keep = field.answer.trim() && field.status === "edited";
    await patchFieldRow(fieldId, {
      status: keep ? "edited" : "needs_you",
      needsReason: out.reason,
      sensitiveCategory: out.sensitiveCategory,
      ...(keep ? {} : { answer: "", draft: "", provenance: "[]" }),
    });
  }
  return {
    fieldId,
    label: field.label,
    status: out.status,
    chars: out.answer.length,
    limit: field.charLimit,
    reason: out.reason,
  };
}

export async function fillFields(
  fieldIds: string[],
  concurrency = 4,
): Promise<FillResult[]> {
  const bank = await listBank();
  const results: FillResult[] = new Array(fieldIds.length);
  let next = 0;
  const worker = async () => {
    while (next < fieldIds.length) {
      const i = next++;
      const id = fieldIds[i]!;
      try {
        results[i] = await draftAndSave(id, bank);
      } catch (e) {
        const field = await getFieldDTO(id);
        results[i] = {
          fieldId: id,
          label: field?.label ?? id,
          status: "needs_you",
          chars: 0,
          limit: field?.charLimit ?? null,
          reason: null,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, fieldIds.length) }, worker),
  );
  return results;
}
