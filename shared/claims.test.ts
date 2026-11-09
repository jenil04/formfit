import { describe, expect, it } from "vitest";

import {
  analyzeClaims,
  checkClaimsDeterministic,
  claimPhrase,
  hasClaimVerb,
  keywords,
  removeSentence,
  splitSentences,
  stem,
} from "./claims.js";
import type { BankSource, EvidenceSource } from "./claims.js";

const evidence: EvidenceSource[] = [
  {
    id: "e1",
    kind: "commit",
    title: "Add dark mode toggle to dashboard",
    sha: "a1b2c3d",
    url: "https://github.com/o/r/commit/a1b2c3d",
  },
  {
    id: "e2",
    kind: "pr",
    title: "Fix crash when exporting empty form",
    sha: "#12",
    url: "https://github.com/o/r/pull/12",
  },
  {
    id: "e3",
    kind: "release",
    title: "v0.3.0 Evidence rail",
    url: "https://github.com/o/r/releases/tag/v0.3.0",
  },
];
const bank: BankSource[] = [
  {
    id: "b1",
    topic: "traction",
    text: "We launched a pilot with 3 studios. pilots: 3",
  },
];

describe("claim detection", () => {
  it("detects built/shipped/launched/integrated verbs", () => {
    for (const s of [
      "We built a parser.",
      "We shipped v1 in March.",
      "Launched the beta last week",
      "We integrated Stripe.",
      "We open-sourced the SDK.",
    ])
      expect(hasClaimVerb(s), s).toBe(true);
    expect(hasClaimVerb("Our team loves forms.")).toBe(false);
  });
  it("splits sentences", () => {
    expect(
      splitSentences("We built X. It is fast! Why? Because."),
    ).toHaveLength(4);
  });
  it("stems plurals and tenses", () => {
    expect(stem("pilots")).toBe(stem("pilot"));
    expect(stem("exporting")).toBe(stem("export"));
  });
  it("drops stopwords and claim verbs from keywords", () => {
    expect(keywords("We integrated Stripe payments")).toEqual([
      stem("stripe"),
      stem("payments"),
    ]);
  });
  it("builds a readable claim phrase", () => {
    expect(claimPhrase("Last year we integrated Stripe, and more.")).toBe(
      "integrated Stripe",
    );
  });
});

describe("deterministic pre-check", () => {
  it("backs a claim with overlapping evidence and cites it", () => {
    const [r] = checkClaimsDeterministic({
      text: "We shipped a dark mode toggle.",
      evidence,
      bank,
    });
    expect(r!.supported).toBe(true);
    expect(r!.citations[0]).toMatchObject({
      kind: "commit",
      id: "e1",
      label: "a1b2c3d",
    });
  });
  it("backs a claim with a bank fact", () => {
    const [r] = checkClaimsDeterministic({
      text: "We launched a pilot with studios.",
      evidence,
      bank,
    });
    expect(r!.supported).toBe(true);
    expect(r!.citations[0]!.kind).toBe("bank");
  });
  it("flags an unbacked claim amber with a reason", () => {
    const [r] = checkClaimsDeterministic({
      text: "We integrated Stripe.",
      evidence,
      bank,
    });
    expect(r!.supported).toBe(false);
    expect(r!.reason).toBe("No commit or bank fact backs 'integrated Stripe'");
  });
  it("leaves a weak single-keyword match for the LLM", () => {
    const c = analyzeClaims({
      text: "We built a mobile dashboard for farmers.",
      evidence,
      bank,
    })[0]!;
    expect(c.strength).toBe("weak");
    const [r] = checkClaimsDeterministic({ text: c.sentence, evidence, bank });
    expect(r!.supported).toBe(false);
  });
  it("ignores sentences that make no build claim", () => {
    expect(
      checkClaimsDeterministic({
        text: "Founders hate forms. We care a lot.",
        evidence,
        bank,
      }),
    ).toEqual([]);
  });
  it("does not let a broad bank entry back a specific claim", () => {
    const broad: BankSource[] = [
      {
        id: "b2",
        topic: "problem",
        text: "Restaurant owners lose hours re-typing orders.",
      },
      {
        id: "b2",
        topic: "problem",
        text: "Owners get a weekly spend summary.",
      },
    ];
    const c = analyzeClaims({
      text: "We shipped a weekly dashboard for restaurant owners.",
      evidence: [],
      bank: broad,
    })[0]!;
    expect(c.strength).toBe("weak");
  });
  it("a user attachment supports exactly that sentence", () => {
    const text = "We integrated Stripe.";
    const [r] = checkClaimsDeterministic({
      text,
      evidence,
      bank,
      attachments: [
        { kind: "commit", id: "e1", label: "a1b2c3d", sentence: text },
      ],
    });
    expect(r).toMatchObject({ supported: true, judged: "user" });
  });
  it("removes a sentence for the fallback fix", () => {
    expect(
      removeSentence(
        "We built X. We integrated Stripe. Done.",
        "We integrated Stripe.",
      ),
    ).toBe("We built X. Done.");
  });
});
