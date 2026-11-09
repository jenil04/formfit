import { describe, expect, it } from "vitest";

import { countChars, countWords, fitToLimits, hardTrim, measure, targetChars } from "./fit";
import { extractNumbers, findUngroundedNumbers } from "./grounding";

describe("measure", () => {
  it("counts chars and words", () => {
    expect(countChars("a\r\nb")).toBe(3);
    expect(countWords("  one two\nthree ")).toBe(3);
  });
  it("tones", () => {
    expect(measure("x".repeat(50), { charLimit: 100 }).tone).toBe("ok");
    expect(measure("x".repeat(95), { charLimit: 100 }).tone).toBe("near");
    expect(measure("x".repeat(101), { charLimit: 100 }).tone).toBe("over");
    expect(measure("a b c", { wordLimit: 2 }).over).toBe(true);
    expect(measure("hello", {}).tone).toBe("none");
  });
  it("targets below the limit", () => {
    expect(targetChars({ charLimit: 300 })).toBeLessThan(300);
  });
});

describe("hardTrim", () => {
  const text =
    "Tidewell turns supplier messages into purchase orders. Owners stop re-typing orders at night. Nine restaurants are piloting it today and more are waiting.";
  it.each([40, 60, 90, 120, 153])("never exceeds %i chars", (n) => {
    const t = hardTrim(text, { charLimit: n });
    expect(t.length).toBeLessThanOrEqual(n);
    expect(t.length).toBeGreaterThan(0);
  });
  it("prefers a sentence boundary", () => {
    expect(hardTrim(text, { charLimit: 100 })).toBe("Tidewell turns supplier messages into purchase orders. Owners stop re-typing orders at night.");
  });
  it("respects word limits", () => {
    expect(countWords(hardTrim(text, { wordLimit: 7 }))).toBeLessThanOrEqual(7);
  });
  it("leaves fitting text alone", () => {
    expect(hardTrim("short", { charLimit: 100 })).toBe("short");
  });
});

describe("fitToLimits", () => {
  it("re-fits via the model until under the limit", async () => {
    let calls = 0;
    const r = await fitToLimits("x ".repeat(200), { charLimit: 100 }, async () => {
      calls += 1;
      return calls === 1 ? "y ".repeat(80) : "short enough";
    });
    expect(r.text).toBe("short enough");
    expect(r.attempts).toBe(2);
    expect(r.trimmed).toBe(false);
  });
  it("falls back to hard trim and never exceeds", async () => {
    const r = await fitToLimits("word ".repeat(100), { charLimit: 50 }, async (t) => t);
    expect(r.text.length).toBeLessThanOrEqual(50);
    expect(r.trimmed).toBe(true);
  });
  it("survives a failing refit", async () => {
    const r = await fitToLimits("word ".repeat(100), { charLimit: 50 }, async () => {
      throw new Error("boom");
    });
    expect(r.text.length).toBeLessThanOrEqual(50);
  });
});

describe("grounding", () => {
  it("normalises figures", () => {
    expect(extractNumbers("$50k and 50,000 and 1.2M and 40%")).toEqual([50000, 50000, 1200000, 40]);
  });
  const corpus = "Nine pilots: 9 active, 112 on waitlist, 3 paid. Founded March 2026. Share: 60%";
  it("accepts grounded figures", () => {
    expect(findUngroundedNumbers("9 pilots, 112 waitlisted, 60% on engineering since 2026.", corpus)).toEqual([]);
  });
  it("flags invented figures", () => {
    expect(findUngroundedNumbers("We grew 300% to $12k MRR with 9 pilots.", corpus)).toEqual(["300%", "$12k"]);
  });
  it("allows listed numbers", () => {
    expect(findUngroundedNumbers("Fits in 280.", "", [280])).toEqual([]);
  });
});
