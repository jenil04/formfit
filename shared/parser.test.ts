import { describe, expect, it } from "vitest";

import { extractLimit, parseFormText } from "./parser";
import { SAMPLE_FORMS } from "./samples";

describe("extractLimit", () => {
  it.each([
    ["Tell us about it (max 500 characters)", 500, null],
    ["Bio (300 chars)", 300, null],
    ["Summary - 100 words max", null, 100],
    ["Pitch. Limit: 1,000 characters", 1000, null],
    ["Why now? (up to 250 chars)", 250, null],
    ["Describe it 0/400", 400, null],
    ["Technologies used (150 character limit)", 150, null],
    ["What is different? (100 words max)", null, 100],
  ])("%s", (line, chars, words) => {
    const r = extractLimit(line);
    expect(r.chars).toBe(chars);
    expect(r.words).toBe(words);
  });

  it("returns nothing when there is no limit", () => {
    expect(extractLimit("Company name")).toMatchObject({ chars: null, words: null });
  });
});

describe("parseFormText", () => {
  it("handles a messy pasted form", () => {
    const f = parseFormText(`Seed Sprint Application
Company name *
One-liner (max 120 characters) Required
What are you building and why does it matter?
Please be concrete. (max 600 characters)
Optional
Website URL
Your email *
Stage
Select one
Idea
MVP
Launched
`);
    expect(f.title).toBe("Seed Sprint Application");
    const byLabel = Object.fromEntries(f.fields.map((x) => [x.label, x]));
    expect(byLabel["Company name"].required).toBe(true);
    expect(byLabel["One-liner"]).toMatchObject({ charLimit: 120, required: true, kind: "short" });
    const big = f.fields.find((x) => x.label.startsWith("What are you building"))!;
    expect(big).toMatchObject({ charLimit: 600, kind: "long", required: false });
    expect(big.help).toContain("concrete");
    expect(byLabel["Website URL"].kind).toBe("url");
    expect(byLabel["Your email"].kind).toBe("email");
    expect(byLabel["Stage"]).toMatchObject({ kind: "select", options: ["Idea", "MVP", "Launched"] });
  });

  it("parses the Lumen sample", () => {
    const f = parseFormText(SAMPLE_FORMS[0].text);
    expect(f.title).toMatch(/Lumen Accelerator/);
    expect(f.fields.map((x) => x.label)).toEqual([
      "Company name",
      "Describe your company in one sentence.",
      "What problem are you solving, and for whom?",
      "Describe your traction to date.",
      "Who is on your founding team?",
      "Why now?",
      "What is your current monthly recurring revenue (USD)?",
      "How do you plan to use the program's resources and funding?",
      "What is your tech stack?",
      "Link to your product demo or website",
      "Primary contact email",
      "Founder phone number",
      "Current stage",
      "How much funding are you seeking?",
      "Founder date of birth (required for program records)",
      "I agree to the Lumen Accelerator terms and conditions",
    ]);
    const l = Object.fromEntries(f.fields.map((x) => [x.label, x]));
    expect(l["Describe your company in one sentence."]).toMatchObject({ charLimit: 140, required: true, kind: "short" });
    expect(l["What problem are you solving, and for whom?"]).toMatchObject({ charLimit: 500, required: true, kind: "long" });
    expect(l["Describe your traction to date."]).toMatchObject({ charLimit: 300, kind: "long" });
    expect(l["Who is on your founding team?"].charLimit).toBe(400);
    expect(l["Why now?"]).toMatchObject({ charLimit: 300, required: true });
    expect(l["What is your tech stack?"].charLimit).toBe(200);
    expect(l["What is your current monthly recurring revenue (USD)?"].kind).toBe("number");
    expect(l["Current stage"]).toMatchObject({
      kind: "select",
      options: ["Idea", "Prototype", "Pilot with customers", "Generating revenue"],
    });
    expect(l["Primary contact email"].kind).toBe("email");
    expect(l["I agree to the Lumen Accelerator terms and conditions"].kind).toBe("checkbox");
  });

  it("parses the Northwind sample with word limits", () => {
    const f = parseFormText(SAMPLE_FORMS[1].text);
    expect(f.fields).toHaveLength(16);
    const l = Object.fromEntries(f.fields.map((x) => [x.label, x]));
    expect(l["Tagline"]).toMatchObject({ charLimit: 80, required: true });
    expect(l["What does your project do?"]).toMatchObject({ charLimit: 1000, kind: "long" });
    expect(l["What makes your approach different from existing tools?"]).toMatchObject({ wordLimit: 100, charLimit: null });
    expect(l["Demo video URL"].kind).toBe("url");
    expect(l["GitHub repository URL"].kind).toBe("url");
    expect(l["Team members and roles"].charLimit).toBe(300);
  });
});
