import { integer, table, text } from "@agent-native/core/db/schema";

// Formfit is a single shared workspace: the answer bank and forms are not
// per-user, so there are no ownable columns. See README "Guardrails".

export const bankEntries = table("ff_bank_entries", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  answer: text("answer").notNull(),
  facts: text("facts").notNull().default("[]"), // JSON BankFact[]
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const forms = table("ff_forms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  sourceText: text("source_text").notNull().default(""),
  status: text("status", { enum: ["draft", "ready", "submitted"] })
    .notNull()
    .default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fields = table("ff_fields", {
  id: text("id").primaryKey(),
  formId: text("form_id").notNull(),
  position: integer("position").notNull(),
  label: text("label").notNull(),
  help: text("help").notNull().default(""),
  kind: text("kind").notNull().default("short"),
  options: text("options").notNull().default("[]"), // JSON string[]
  charLimit: integer("char_limit"),
  wordLimit: integer("word_limit"),
  required: integer("required").notNull().default(0),
  status: text("status").notNull().default("empty"),
  needsReason: text("needs_reason"),
  sensitiveCategory: text("sensitive_category"),
  draft: text("draft").notNull().default(""), // last AI draft, kept for learn-from-edit
  answer: text("answer").notNull().default(""), // what the user would paste
  provenance: text("provenance").notNull().default("[]"), // JSON Provenance[]
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const proposals = table("ff_bank_proposals", {
  id: text("id").primaryKey(),
  formId: text("form_id").notNull(),
  fieldId: text("field_id").notNull(),
  entryId: text("entry_id"), // null => propose a new entry
  topic: text("topic").notNull(),
  summary: text("summary").notNull(),
  beforeAnswer: text("before_answer").notNull().default(""),
  afterAnswer: text("after_answer").notNull().default(""),
  newFacts: text("new_facts").notNull().default("[]"), // JSON BankFact[]
  status: text("status", { enum: ["pending", "accepted", "dismissed"] })
    .notNull()
    .default("pending"),
  createdAt: text("created_at").notNull(),
});
