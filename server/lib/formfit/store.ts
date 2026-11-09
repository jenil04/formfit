import { and, asc, desc, eq } from "drizzle-orm";

import { classifyField } from "../../../shared/classifier.js";
import { measure } from "../../../shared/fit.js";
import type { ParsedForm } from "../../../shared/parser.js";
import { SEED_BANK } from "../../../shared/seed.js";
import type { EvidenceDraft } from "../../../shared/github.js";
import type {
  BankFact,
  Citation,
  ClaimResult,
  EvidenceKind,
  FieldKind,
  FieldStatus,
  FormStatus,
  Provenance,
} from "../../../shared/types.js";
import { getDb, schema } from "../../db/index.js";

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ---------- Bank ----------

export interface BankEntryDTO {
  id: string;
  topic: string;
  title: string;
  answer: string;
  facts: BankFact[];
  updatedAt: string;
}

function toBank(row: typeof schema.bankEntries.$inferSelect): BankEntryDTO {
  return {
    id: row.id,
    topic: row.topic,
    title: row.title,
    answer: row.answer,
    facts: parseJson<BankFact[]>(row.facts, []),
    updatedAt: row.updatedAt,
  };
}

export async function listBank(): Promise<BankEntryDTO[]> {
  const rows = await getDb()
    .select()
    .from(schema.bankEntries)
    .orderBy(
      asc(schema.bankEntries.position),
      asc(schema.bankEntries.createdAt),
    );
  return rows.map(toBank);
}

export async function getBankEntry(id: string): Promise<BankEntryDTO | null> {
  const [row] = await getDb()
    .select()
    .from(schema.bankEntries)
    .where(eq(schema.bankEntries.id, id));
  return row ? toBank(row) : null;
}

export async function saveBankEntry(input: {
  id?: string | undefined;
  topic: string;
  title?: string | undefined;
  answer: string;
  facts?: BankFact[] | undefined;
}): Promise<BankEntryDTO> {
  const db = getDb();
  const now = nowIso();
  const facts = (input.facts ?? [])
    .map((f) => ({
      key: f.key.trim(),
      value: f.value.trim(),
      ...(f.source?.trim() ? { source: f.source.trim() } : {}),
    }))
    .filter((f) => f.key && f.value);
  const existing = input.id ? await getBankEntry(input.id) : null;
  if (existing) {
    await db
      .update(schema.bankEntries)
      .set({
        topic: input.topic.trim(),
        title: input.title?.trim() || existing.title,
        answer: input.answer,
        facts: JSON.stringify(input.facts ? facts : existing.facts),
        updatedAt: now,
      })
      .where(eq(schema.bankEntries.id, existing.id));
    return (await getBankEntry(existing.id))!;
  }
  const id = input.id ?? newId("bank");
  const count = (await listBank()).length;
  await db.insert(schema.bankEntries).values({
    id,
    topic: input.topic.trim(),
    title: input.title?.trim() || input.topic.trim(),
    answer: input.answer,
    facts: JSON.stringify(facts),
    position: count,
    createdAt: now,
    updatedAt: now,
  });
  return (await getBankEntry(id))!;
}

export async function removeBankEntry(id: string): Promise<boolean> {
  const existing = await getBankEntry(id);
  if (!existing) return false;
  await getDb().delete(schema.bankEntries).where(eq(schema.bankEntries.id, id));
  return true;
}

export async function seedBank(): Promise<number> {
  const existing = new Set((await listBank()).map((e) => e.id));
  let added = 0;
  for (const e of SEED_BANK) {
    if (existing.has(e.id)) continue;
    await saveBankEntry(e);
    added += 1;
  }
  return added;
}

// ---------- Forms & fields ----------

export interface FieldDTO {
  id: string;
  formId: string;
  position: number;
  label: string;
  help: string;
  kind: FieldKind;
  options: string[];
  charLimit: number | null;
  wordLimit: number | null;
  required: boolean;
  status: FieldStatus;
  needsReason: string | null;
  sensitiveCategory: string | null;
  draft: string;
  answer: string;
  provenance: Provenance[];
  citations: Citation[];
  claims: ClaimResult[];
  chars: number;
  words: number;
  over: boolean;
  updatedAt: string;
}

export interface ProposalDTO {
  id: string;
  formId: string;
  fieldId: string;
  entryId: string | null;
  topic: string;
  summary: string;
  beforeAnswer: string;
  afterAnswer: string;
  newFacts: BankFact[];
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
}

export interface FormSummary {
  id: string;
  title: string;
  status: FormStatus;
  total: number;
  needsYou: number;
  filled: number;
  ready: number;
  unsupported: number;
  updatedAt: string;
}

export interface FormDTO extends FormSummary {
  description: string;
  programId: string | null;
  organizer: string | null;
  money: string | null;
  deadline: string | null;
  sourceUrl: string | null;
  fields: FieldDTO[];
  proposals: ProposalDTO[];
}

function toField(row: typeof schema.fields.$inferSelect): FieldDTO {
  const m = measure(row.answer, {
    charLimit: row.charLimit,
    wordLimit: row.wordLimit,
  });
  return {
    id: row.id,
    formId: row.formId,
    position: row.position,
    label: row.label,
    help: row.help,
    kind: row.kind as FieldKind,
    options: parseJson<string[]>(row.options, []),
    charLimit: row.charLimit,
    wordLimit: row.wordLimit,
    required: row.required === 1,
    status: row.status as FieldStatus,
    needsReason: row.needsReason,
    sensitiveCategory: row.sensitiveCategory,
    draft: row.draft,
    answer: row.answer,
    provenance: parseJson<Provenance[]>(row.provenance, []),
    citations: parseJson<Citation[]>(row.citations, []),
    claims: parseJson<ClaimResult[]>(row.claims, []),
    chars: m.chars,
    words: m.words,
    over: m.over,
    updatedAt: row.updatedAt,
  };
}

function summarize(
  form: typeof schema.forms.$inferSelect,
  fields: FieldDTO[],
): FormSummary {
  return {
    id: form.id,
    title: form.title,
    status: form.status as FormStatus,
    total: fields.length,
    needsYou: fields.filter((f) => f.status === "needs_you").length,
    filled: fields.filter((f) => f.answer.trim() && f.status !== "needs_you")
      .length,
    ready: fields.filter((f) => f.status === "ready").length,
    unsupported: fields.reduce(
      (n, f) => n + f.claims.filter((c) => !c.supported).length,
      0,
    ),
    updatedAt: form.updatedAt,
  };
}

export async function listFormSummaries(): Promise<FormSummary[]> {
  const db = getDb();
  const forms = await db
    .select()
    .from(schema.forms)
    .orderBy(desc(schema.forms.createdAt));
  const out: FormSummary[] = [];
  for (const f of forms) {
    const rows = await db
      .select()
      .from(schema.fields)
      .where(eq(schema.fields.formId, f.id));
    out.push(summarize(f, rows.map(toField)));
  }
  return out;
}

export async function getFormDTO(id: string): Promise<FormDTO | null> {
  const db = getDb();
  const [form] = await db
    .select()
    .from(schema.forms)
    .where(eq(schema.forms.id, id));
  if (!form) return null;
  const rows = await db
    .select()
    .from(schema.fields)
    .where(eq(schema.fields.formId, id))
    .orderBy(asc(schema.fields.position));
  const fields = rows.map(toField);
  const props = await db
    .select()
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.formId, id),
        eq(schema.proposals.status, "pending"),
      ),
    )
    .orderBy(desc(schema.proposals.createdAt));
  return {
    ...summarize(form, fields),
    description: form.description,
    programId: form.programId,
    organizer: form.organizer,
    money: form.money,
    deadline: form.deadline,
    sourceUrl: form.sourceUrl,
    fields,
    proposals: props.map((p) => ({
      id: p.id,
      formId: p.formId,
      fieldId: p.fieldId,
      entryId: p.entryId,
      topic: p.topic,
      summary: p.summary,
      beforeAnswer: p.beforeAnswer,
      afterAnswer: p.afterAnswer,
      newFacts: parseJson<BankFact[]>(p.newFacts, []),
      status: p.status,
      createdAt: p.createdAt,
    })),
  };
}

export async function getFieldDTO(id: string): Promise<FieldDTO | null> {
  const [row] = await getDb()
    .select()
    .from(schema.fields)
    .where(eq(schema.fields.id, id));
  return row ? toField(row) : null;
}

export async function createForm(input: {
  parsed: ParsedForm;
  sourceText: string;
  title?: string | undefined;
  program?:
    | {
        programId: string;
        organizer: string | null;
        money: string | null;
        deadline: string | null;
        sourceUrl: string | null;
      }
    | undefined;
}): Promise<FormDTO> {
  const db = getDb();
  const now = nowIso();
  const id = newId("form");
  await db.insert(schema.forms).values({
    id,
    title: input.title?.trim() || input.parsed.title,
    description: input.parsed.description,
    sourceText: input.sourceText,
    status: "draft",
    ...(input.program ?? {}),
    createdAt: now,
    updatedAt: now,
  });
  await insertFields(id, input.parsed, 0);
  return (await getFormDTO(id))!;
}

/** Append parsed fields to an existing form (used when pasting fields into a program-started form). */
export async function addFieldsToForm(
  formId: string,
  parsed: ParsedForm,
  sourceText: string,
): Promise<FormDTO> {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.fields)
    .where(eq(schema.fields.formId, formId));
  await insertFields(formId, parsed, existing.length);
  await db
    .update(schema.forms)
    .set({ sourceText, updatedAt: nowIso() })
    .where(eq(schema.forms.id, formId));
  return (await getFormDTO(formId))!;
}

async function insertFields(
  id: string,
  parsed: ParsedForm,
  startAt: number,
): Promise<void> {
  const db = getDb();
  const now = nowIso();
  let position = startAt;
  for (const f of parsed.fields) {
    const c = classifyField({ label: f.label, help: f.help, kind: f.kind });
    await db.insert(schema.fields).values({
      id: newId("fld"),
      formId: id,
      position: position++,
      label: f.label,
      help: f.help,
      kind: f.kind,
      options: JSON.stringify(f.options),
      charLimit: f.charLimit,
      wordLimit: f.wordLimit,
      required: f.required ? 1 : 0,
      status: c.sensitive ? "needs_you" : "empty",
      needsReason: c.reason,
      sensitiveCategory: c.category,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function deleteForm(id: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.proposals).where(eq(schema.proposals.formId, id));
  await db.delete(schema.fields).where(eq(schema.fields.formId, id));
  await db.delete(schema.forms).where(eq(schema.forms.id, id));
}

export async function touchForm(formId: string): Promise<void> {
  await getDb()
    .update(schema.forms)
    .set({ updatedAt: nowIso() })
    .where(eq(schema.forms.id, formId));
}

export async function patchFieldRow(
  id: string,
  patch: Partial<typeof schema.fields.$inferInsert>,
): Promise<FieldDTO> {
  const db = getDb();
  await db
    .update(schema.fields)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(schema.fields.id, id));
  const field = (await getFieldDTO(id))!;
  await touchForm(field.formId);
  return field;
}

export async function wipeAll(): Promise<void> {
  const db = getDb();
  await db.delete(schema.proposals);
  await db.delete(schema.fields);
  await db.delete(schema.forms);
  await db.delete(schema.bankEntries);
  await db.delete(schema.evidence);
}

// ---------- Evidence ----------

export interface EvidenceDTO {
  id: string;
  repo: string;
  kind: EvidenceKind;
  title: string;
  date: string;
  url: string;
  sha: string | null;
  fictional: boolean;
}

function toEvidence(row: typeof schema.evidence.$inferSelect): EvidenceDTO {
  return {
    id: row.id,
    repo: row.repo,
    kind: row.kind,
    title: row.title,
    date: row.date,
    url: row.url,
    sha: row.sha,
    fictional: row.fictional === 1,
  };
}

export async function listEvidence(repo?: string): Promise<EvidenceDTO[]> {
  const q = getDb().select().from(schema.evidence);
  const rows = await (
    repo ? q.where(eq(schema.evidence.repo, repo)) : q
  ).orderBy(desc(schema.evidence.date));
  return rows.map(toEvidence);
}

/** Idempotent: re-importing the same repo refreshes rows instead of duplicating them. */
export async function saveEvidence(
  items: EvidenceDraft[],
  fictional = false,
): Promise<{ added: number; updated: number }> {
  const db = getDb();
  const have = new Set((await listEvidence()).map((e) => e.id));
  let added = 0;
  let updated = 0;
  for (const e of items) {
    const row = {
      repo: e.repo,
      kind: e.kind,
      title: e.title,
      date: e.date,
      url: e.url,
      sha: e.sha,
      fictional: fictional ? 1 : 0,
    };
    if (have.has(e.id)) {
      await db
        .update(schema.evidence)
        .set(row)
        .where(eq(schema.evidence.id, e.id));
      updated += 1;
    } else {
      await db
        .insert(schema.evidence)
        .values({ id: e.id, ...row, createdAt: nowIso() });
      added += 1;
    }
  }
  return { added, updated };
}

export async function removeEvidence(repo: string): Promise<number> {
  const n = (await listEvidence(repo)).length;
  await getDb().delete(schema.evidence).where(eq(schema.evidence.repo, repo));
  return n;
}
