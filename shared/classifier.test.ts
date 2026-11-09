import { describe, expect, it } from "vitest";

import { classifyField } from "./classifier";
import type { FieldKind } from "./types";

const cases: Array<[string, string, string | null, FieldKind?]> = [
  ["Payout wallet address (for grant payment)", "", "wallet"],
  ["Solana address", "", "wallet"],
  ["Founder phone number", "", "phone"],
  ["WhatsApp", "", "phone"],
  ["Government ID or passport number", "", "government-id"],
  ["Complete KYC", "", "government-id"],
  ["Tax ID (EIN, PAN or equivalent)", "", "tax-id"],
  ["Enter your PAN", "", "tax-id"],
  ["Home address", "", "home-address"],
  ["Shipping address for winner swag", "", "home-address"],
  ["Founder date of birth", "", "date-of-birth"],
  ["Bank account number", "", "bank-card"],
  ["IBAN", "", "bank-card"],
  ["I agree to the terms and conditions", "", "legal", "checkbox"],
  ["Electronic signature", "", "legal"],
  ["Subscribe to updates", "", "legal", "checkbox"],
  ["How much funding are you seeking?", "", "investment-terms"],
  ["What valuation cap would you accept?", "", "investment-terms"],
  ["Reference contact email", "", "references"],
  ["Please provide two references with phone numbers", "", "phone"],
  // Not sensitive:
  ["Company name", "", null],
  ["Primary contact email", "", null],
  ["Email address", "", null],
  ["Website address", "", null],
  ["Link to your product demo or website", "", null],
  ["How do you plan to use the funds?", "", null],
  ["Use of funds", "", null],
  ["Describe your traction", "", null],
  ["Describe your company in one sentence.", "By submitting you agree to our terms.", null],
  ["What is your tech stack?", "", null],
  ["Why now?", "", null],
  ["What stage are you at?", "", null],
  ["Who is on your founding team?", "", null],
  ["Fundraising history", "", null],
];

describe("classifyField", () => {
  it.each(cases)("%s -> %s", (label, help, category, kind) => {
    const c = classifyField({ label, help, kind });
    expect(c.category).toBe(category);
    expect(c.sensitive).toBe(category !== null);
    if (category) expect(c.reason).toBeTruthy();
  });
});
