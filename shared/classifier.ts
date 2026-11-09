import type { FieldKind } from "./types";

export type SensitiveCategory =
  | "wallet"
  | "phone"
  | "government-id"
  | "tax-id"
  | "home-address"
  | "date-of-birth"
  | "bank-card"
  | "legal"
  | "investment-terms"
  | "references";

export interface Classification {
  sensitive: boolean;
  category: SensitiveCategory | null;
  reason: string | null;
}

interface Rule {
  category: SensitiveCategory;
  reason: string;
  test: (
    text: string,
    raw: string,
    kind?: FieldKind,
    label?: string,
  ) => boolean;
}

const re = (pattern: RegExp) => (text: string) => pattern.test(text);

/**
 * Order matters: the first matching rule wins, most specific first.
 * `text` is lowercased label + help; `raw` keeps the original case (for PAN/EIN).
 */
const RULES: Rule[] = [
  {
    category: "wallet",
    reason: "Wallet and payout addresses can only come from you.",
    test: re(
      /\b(wallet|payout|payment address|usdc|usdt|ethereum|solana|bitcoin|btc address|eth address|crypto address|public key|ens name|0x)\b/,
    ),
  },
  {
    category: "bank-card",
    reason:
      "Bank and card details are never stored or drafted. Enter them yourself.",
    test: re(
      /\b(bank (account|name|details)|account number|routing number|iban|swift|bic code|sort code|ifsc|card number|credit card|debit card|cvv|paypal|wire (details|instructions))\b/,
    ),
  },
  {
    category: "government-id",
    reason: "Government ID and KYC details can only come from you.",
    test: re(
      /\b(passport|national id|government[- ]?(issued )?id|id (card|number|document)|driver'?s? licen[cs]e|kyc|aadhaar|aadhar|ssn|social security|visa number|citizenship|nationality|identity (document|verification))\b/,
    ),
  },
  {
    category: "tax-id",
    reason: "Tax identifiers (EIN, PAN, TIN, VAT) can only come from you.",
    test: (text, raw) =>
      /\b(tax (id|identification|number|registration)|\bein\b|\btin\b|\bitin\b|vat (id|number)|gst(in)?|pan (card|number))\b/.test(
        text,
      ) || /\bPAN\b/.test(raw),
  },
  {
    category: "date-of-birth",
    reason: "Date of birth is personal. Only you can provide it.",
    test: re(/\b(date of birth|birth ?date|dob|birthday|year of birth)\b/),
  },
  {
    category: "phone",
    reason: "Phone numbers are personal. Only you can provide yours.",
    test: re(
      /\b(phone|mobile|whatsapp|telephone|cell(phone)?( number)?|contact number)\b/,
    ),
  },
  {
    category: "references",
    reason:
      "Reference contact details belong to other people. You supply them.",
    test: (text) =>
      /\b(references?|referees?|referrer)\b/.test(text) &&
      /\b(contact|email|e-mail|phone|name|details|linkedin)\b/.test(text),
  },
  {
    category: "home-address",
    reason: "Street and home addresses can only come from you.",
    test: (text) =>
      /\b(home|street|mailing|residential|postal|billing|registered|office|business|company|personal|your|current|permanent)?\s?address\b/.test(
        text,
      ) &&
      !/\b(email|e-mail|web|website|url|ip|wallet|contract|crypto)\s+address\b/.test(
        text,
      ) &&
      !/\bemail\b.*\baddress\b/.test(text),
  },
  {
    category: "investment-terms",
    reason:
      "Equity and investment terms are your decision, not something to draft.",
    test: re(
      /\b(equity|valuation|safe note|convertible note|cap table|dilution|ownership (percentage|stake)|stake|investment (amount|terms)|terms of (the )?(investment|deal)|funding (ask|amount|requested)|amount (requested|raising)|how much (are you )?(raising|asking)|round size|raising|funding (are you )?(seeking|requesting)|how much (funding|money|capital)|seeking (funding|investment)|pre-?money|post-?money|discount rate)\b/,
    ),
  },
  {
    category: "legal",
    reason: "Legal attestations, terms and signatures must be given by you.",
    // Label only: help text often says "by submitting you agree..." on ordinary fields.
    test: (_text, _raw, kind, label = "") =>
      kind === "checkbox" ||
      /\b(i agree|i accept|i certify|i attest|i acknowledge|i confirm|i consent|agree to|terms (and|&) conditions|terms of (service|use|participation)|privacy policy|signature|sign here|e-?sign|attest|certify|consent|legally binding|code of conduct|declaration|waiver|indemnif)\b/.test(
        label,
      ),
  },
];

export function classifyField(input: {
  label: string;
  help?: string | undefined;
  kind?: FieldKind | undefined;
}): Classification {
  const raw = `${input.label} ${input.help ?? ""}`;
  const text = raw.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(text, raw, input.kind, input.label.toLowerCase())) {
      return { sensitive: true, category: rule.category, reason: rule.reason };
    }
  }
  return { sensitive: false, category: null, reason: null };
}
