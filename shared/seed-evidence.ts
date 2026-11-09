import type { EvidenceDraft } from "./github.js";

/** Prefilled in the Evidence rail and tried first by the demo seed. */
export const DEFAULT_EVIDENCE_REPO = "https://github.com/jenil04/formfit";

const REPO = "tidewell/tidewell-app";
const e = (
  kind: EvidenceDraft["kind"],
  key: string,
  title: string,
  date: string,
  sha: string | null,
): EvidenceDraft => ({
  id: `${kind}:${REPO}:${key}`,
  repo: REPO,
  kind,
  title,
  date,
  url: "",
  sha,
});

/** Fictional Tidewell work, used ONLY when the real import fails. Never linked; flagged `fictional`. */
export const SAMPLE_EVIDENCE: EvidenceDraft[] = [
  e(
    "release",
    "v0.4.0",
    "v0.4.0 Weekly spend summary",
    "2026-11-04T10:00:00Z",
    null,
  ),
  e("release", "v0.2.0", "v0.2.0 Private beta", "2026-09-08T10:00:00Z", null),
  e(
    "pr",
    "58",
    "Send purchase orders back over WhatsApp Business API",
    "2026-10-21T15:00:00Z",
    "#58",
  ),
  e(
    "pr",
    "44",
    "Match extracted order lines to supplier catalogues",
    "2026-10-02T15:00:00Z",
    "#44",
  ),
  e(
    "pr",
    "31",
    "Parse supplier order emails into line items",
    "2026-09-19T15:00:00Z",
    "#31",
  ),
  e(
    "commit",
    "c0ffee1",
    "Add weekly spend summary email for owners",
    "2026-11-03T09:12:00Z",
    "c0ffee1",
  ),
  e(
    "commit",
    "c0ffee2",
    "Add order history view with supplier filter",
    "2026-10-28T11:40:00Z",
    "c0ffee2",
  ),
  e(
    "commit",
    "c0ffee3",
    "Add Twilio SMS fallback for suppliers without WhatsApp",
    "2026-10-25T16:05:00Z",
    "c0ffee3",
  ),
  e(
    "commit",
    "c0ffee4",
    "Validate extracted quantities and units against catalogue",
    "2026-10-09T13:22:00Z",
    "c0ffee4",
  ),
  e(
    "commit",
    "c0ffee5",
    "Add voicemail transcription to order intake",
    "2026-09-27T08:50:00Z",
    "c0ffee5",
  ),
];
