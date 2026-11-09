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
