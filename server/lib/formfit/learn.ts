import { fail } from "@agent-native/core/action";
import { desc, eq, and } from "drizzle-orm";

import { extractNumbers } from "../../../shared/grounding.js";
import type { BankFact } from "../../../shared/types.js";
import { getDb, schema } from "../../db/index.js";
import { ask, extractJson } from "./llm.js";
import {
  getBankEntry,
  listBank,
  newId,
  nowIso,
  saveBankEntry,
  type BankEntryDTO,
  type FieldDTO,
  type ProposalDTO,
} from "./store.js";

const LEARN_SYSTEM = `You maintain a founder's answer bank. The founder edited a drafted form answer. Propose the smallest bank update that captures what the edit teaches.
Rules: only use information present in the edited answer; never invent. A "newFact" must be a short key plus a value copied from the edited answer. "newAnswer" is the full updated canonical answer for the target entry (keep its voice; fold in new information or a clearly better phrasing; do not shorten it to the field's limit). If the edit teaches nothing durable (pure shortening/formatting), return {"nothing":true}.
Reply with one JSON object only:
{"nothing":false,"entryId":"existing entry id or null for a new entry","topic":"topic for a new entry","summary":"one short sentence for the diff header","newAnswer":"...","newFacts":[{"key":"...","value":"...","source":"Edited on <form title>"}]}`;

interface ModelProposal {
  nothing?: boolean;
  entryId?: string | null;
  topic?: string;
  summary?: string;
  newAnswer?: string;
  newFacts?: BankFact[];
}

export type LearnOutcome =
  | { proposal: ProposalDTO; note?: undefined }
  | { proposal: null; note: string };

function toProposal(row: typeof schema.proposals.$inferSelect): ProposalDTO {
  return {
    id: row.id,
    formId: row.formId,
    fieldId: row.fieldId,
    entryId: row.entryId,
    topic: row.topic,
    summary: row.summary,
    beforeAnswer: row.beforeAnswer,
    afterAnswer: row.afterAnswer,
    newFacts: JSON.parse(row.newFacts) as BankFact[],
    status: row.status,
    createdAt: row.createdAt,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export async function proposeFromEdit(
  field: FieldDTO,
  formTitle: string,
): Promise<LearnOutcome> {
  if (field.sensitiveCategory) {
    return {
      proposal: null,
      note: "This field holds personal details, so Formfit never learns from it.",
    };
  }
  const edited = field.answer.trim();
  if (!edited) return { proposal: null, note: "The field is empty." };
  if (edited === field.draft.trim()) {
    return { proposal: null, note: "No edit to learn from yet." };
  }

  const bank = await listBank();
  const primary =
    field.provenance
      .map((p) => bank.find((e) => e.id === p.entryId))
      .find(Boolean) ?? null;
  const corpus = norm(
    bank
      .map((e) => `${e.answer} ${e.facts.map((f) => f.value).join(" ")}`)
      .join(" "),
  );
  const knownNumbers = new Set(extractNumbers(corpus));
  const newNumbers = extractNumbers(edited).filter((n) => !knownNumbers.has(n));

  let parsed: ModelProposal | null = null;
  try {
    const raw = await ask(
      LEARN_SYSTEM,
      `FORM: ${formTitle}\nFIELD: ${field.label}\n\nORIGINAL DRAFT:\n${field.draft || "(none: the founder wrote this from scratch)"}\n\nEDITED ANSWER:\n${edited}\n\nTARGET ENTRY (${primary?.id ?? "none"}):\n${
        primary
          ? `topic: ${primary.topic}\nanswer: ${primary.answer}\nfacts: ${primary.facts.map((f) => `${f.key}=${f.value}`).join("; ")}`
          : "(no source entry; propose a new one)"
      }\n\nOTHER ENTRIES (topics): ${bank.map((e) => `${e.id}:${e.topic}`).join(", ")}`,
      1200,
    );
    parsed = extractJson<ModelProposal>(raw);
  } catch {
    parsed = null;
  }

  let entryId: string | null = primary?.id ?? null;
  let topic = primary?.topic ?? field.label.toLowerCase().slice(0, 40);
  let summary = "";
  let afterAnswer = primary?.answer ?? edited;
  let newFacts: BankFact[] = [];

  if (parsed && !parsed.nothing) {
    if (parsed.entryId && bank.some((e) => e.id === parsed!.entryId)) {
      entryId = parsed.entryId;
    } else if (parsed.entryId === null) {
      entryId = null;
    }
    topic = parsed.topic?.trim() || topic;
    summary = parsed.summary?.trim().slice(0, 160) ?? "";
    if (parsed.newAnswer?.trim() && parsed.newAnswer.length <= 4000) {
      afterAnswer = parsed.newAnswer.trim();
    }
    // A fact only counts if its value is literally in the edited answer.
    newFacts = (parsed.newFacts ?? [])
      .filter(
        (f) =>
          f?.key?.trim() &&
          f?.value?.trim() &&
          norm(edited).includes(norm(f.value)),
      )
      .map((f) => ({
        key: f.key.trim(),
        value: f.value.trim(),
        source: f.source?.trim() || `Edited on ${formTitle}`,
      }));
  } else if (parsed?.nothing) {
    return {
      proposal: null,
      note: "That edit was only shortening or formatting; nothing new for the bank.",
    };
  } else if (newNumbers.length) {
    // Model unavailable: deterministic fallback proposes the new figures as facts.
    newFacts = [...edited.matchAll(/\$?\d[\d,.]*\s?(?:k|m|%|x)?/gi)]
      .map((m) => m[0].trim())
      .filter((v) => newNumbers.includes(extractNumbers(v)[0] ?? NaN))
      .slice(0, 3)
      .map((value) => ({
        key: `${field.label.replace(/[?:]+$/, "").slice(0, 40)} (from edit)`,
        value,
        source: `Edited on ${formTitle}`,
      }));
    summary = "New figures from your edit";
  } else {
    return { proposal: null, note: "Nothing new to learn from this edit." };
  }

  const before = entryId ? ((await getBankEntry(entryId))?.answer ?? "") : "";
  const existingFacts = new Set(
    (entryId ? ((await getBankEntry(entryId))?.facts ?? []) : []).map(
      (f) => `${norm(f.key)}=${norm(f.value)}`,
    ),
  );
  newFacts = newFacts.filter(
    (f) => !existingFacts.has(`${norm(f.key)}=${norm(f.value)}`),
  );
  const answerChanged = norm(afterAnswer) !== norm(before);
  if (!answerChanged && newFacts.length === 0) {
    return {
      proposal: null,
      note: "Your bank already says this. Nothing to add.",
    };
  }
  if (!summary) {
    summary =
      newFacts.length && !answerChanged
        ? `Add ${newFacts.length} new fact${newFacts.length > 1 ? "s" : ""} to ${topic}`
        : `Update "${topic}" with your wording`;
  }

  const db = getDb();
  await db
    .delete(schema.proposals)
    .where(
      and(
        eq(schema.proposals.fieldId, field.id),
        eq(schema.proposals.status, "pending"),
      ),
    );
  const row = {
    id: newId("prop"),
    formId: field.formId,
    fieldId: field.id,
    entryId,
    topic,
    summary,
    beforeAnswer: before,
    afterAnswer: answerChanged ? afterAnswer : before,
    newFacts: JSON.stringify(newFacts),
    status: "pending" as const,
    createdAt: nowIso(),
  };
  await db.insert(schema.proposals).values(row);
  return { proposal: toProposal(row) };
}

export async function applyProposal(
  id: string,
  dismiss = false,
): Promise<{ entry: BankEntryDTO | null; proposal: ProposalDTO }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.id, id));
  if (!row)
    fail(`Proposal ${id} not found`, {
      errorCode: "invalid_request",
      statusCode: 400,
    });
  const proposal = toProposal(row);
  if (row.status !== "pending") {
    fail(`Proposal ${id} was already ${row.status}`, {
      errorCode: "invalid_request",
      statusCode: 400,
    });
  }
  if (dismiss) {
    await db
      .update(schema.proposals)
      .set({ status: "dismissed" })
      .where(eq(schema.proposals.id, id));
    return { entry: null, proposal: { ...proposal, status: "dismissed" } };
  }

  let entry: BankEntryDTO;
  const existing = proposal.entryId
    ? await getBankEntry(proposal.entryId)
    : null;
  if (existing) {
    const facts = [...existing.facts];
    for (const f of proposal.newFacts) {
      const i = facts.findIndex((x) => norm(x.key) === norm(f.key));
      if (i >= 0) facts[i] = f;
      else facts.push(f);
    }
    entry = await saveBankEntry({
      id: existing.id,
      topic: existing.topic,
      answer: proposal.afterAnswer || existing.answer,
      facts,
    });
  } else {
    entry = await saveBankEntry({
      topic: proposal.topic,
      answer: proposal.afterAnswer,
      facts: proposal.newFacts,
    });
  }
  await db
    .update(schema.proposals)
    .set({ status: "accepted", entryId: entry.id })
    .where(eq(schema.proposals.id, id));
  return {
    entry,
    proposal: { ...proposal, status: "accepted", entryId: entry.id },
  };
}

export async function listPendingProposals(formId?: string) {
  const rows = await getDb()
    .select()
    .from(schema.proposals)
    .where(
      formId
        ? and(
            eq(schema.proposals.formId, formId),
            eq(schema.proposals.status, "pending"),
          )
        : eq(schema.proposals.status, "pending"),
    )
    .orderBy(desc(schema.proposals.createdAt));
  return rows.map(toProposal);
}
