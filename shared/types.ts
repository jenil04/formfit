export const FIELD_KINDS = [
  "short",
  "long",
  "url",
  "email",
  "select",
  "number",
  "date",
  "checkbox",
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const FIELD_STATUSES = [
  "empty",
  "drafted",
  "needs_you",
  "edited",
  "ready",
] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export const FORM_STATUSES = ["draft", "ready", "submitted"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export interface BankFact {
  key: string;
  value: string;
  source?: string | undefined;
}

export interface Provenance {
  entryId: string;
  topic: string;
  factKey?: string;
}

export interface ParsedField {
  label: string;
  help: string;
  kind: FieldKind;
  charLimit: number | null;
  wordLimit: number | null;
  required: boolean;
  options: string[];
}

export interface Limits {
  charLimit?: number | null;
  wordLimit?: number | null;
}

export const EVIDENCE_KINDS = ["commit", "pr", "release"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** A citation chip: a bank entry, or a commit / PR / release. */
export interface Citation {
  kind: "bank" | EvidenceKind;
  id: string;
  label: string;
  url?: string | undefined;
  /** Set when the user attached this evidence to one specific sentence. */
  sentence?: string | undefined;
}

export interface ClaimResult {
  sentence: string;
  supported: boolean;
  citations: Citation[];
  /** Why it is amber, e.g. "No commit or bank fact backs 'integrated Stripe'". */
  reason?: string | undefined;
  /** Weak keyword matches the user could attach with one click. */
  suggestions?: Citation[] | undefined;
  judged: "deterministic" | "llm" | "user";
}
