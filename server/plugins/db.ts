import {
  ensureAdditiveColumns,
  getDbExec,
  runMigrations,
} from "@agent-native/core/db";

import * as schema from "../db/schema.js";

function isDrizzleTable(value: unknown): value is object {
  return (
    !!value &&
    typeof value === "object" &&
    Object.getOwnPropertySymbols(value).some((s) =>
      s.toString().includes("drizzle"),
    )
  );
}

const schemaTables = Object.values(schema).filter(isDrizzleTable);

export const runFormfitMigrations = runMigrations(
  [
    {
      version: 1,
      name: "formfit-initial-schema",
      sql: `CREATE TABLE IF NOT EXISTS ff_bank_entries (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  answer TEXT NOT NULL,
  facts TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ff_forms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ff_fields (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  help TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'short',
  options TEXT NOT NULL DEFAULT '[]',
  char_limit INTEGER,
  word_limit INTEGER,
  required INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'empty',
  needs_reason TEXT,
  sensitive_category TEXT,
  draft TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  provenance TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ff_fields_form_idx ON ff_fields (form_id, position);
CREATE TABLE IF NOT EXISTS ff_bank_proposals (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  entry_id TEXT,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_answer TEXT NOT NULL DEFAULT '',
  after_answer TEXT NOT NULL DEFAULT '',
  new_facts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
)`,
    },
    {
      version: 2,
      name: "formfit-evidence-programs-claims",
      sql: `CREATE TABLE IF NOT EXISTS ff_evidence (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  sha TEXT,
  fictional INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ff_evidence_repo_idx ON ff_evidence (repo, date);
ALTER TABLE ff_forms ADD COLUMN IF NOT EXISTS program_id TEXT;
ALTER TABLE ff_forms ADD COLUMN IF NOT EXISTS organizer TEXT;
ALTER TABLE ff_forms ADD COLUMN IF NOT EXISTS money TEXT;
ALTER TABLE ff_forms ADD COLUMN IF NOT EXISTS deadline TEXT;
ALTER TABLE ff_forms ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE ff_fields ADD COLUMN IF NOT EXISTS citations TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ff_fields ADD COLUMN IF NOT EXISTS claims TEXT NOT NULL DEFAULT '[]'`,
    },
  ],
  { table: "formfit_migrations" },
);

export default async (nitroApp: unknown): Promise<void> => {
  await runFormfitMigrations(nitroApp);
  try {
    await ensureAdditiveColumns({ db: getDbExec(), tables: schemaTables });
  } catch (error) {
    console.warn(
      "[formfit/db] additive schema check failed",
      error instanceof Error ? error.message : error,
    );
  }
};
