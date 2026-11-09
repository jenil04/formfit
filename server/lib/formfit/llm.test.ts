import { describe, expect, it, vi } from "vitest";

vi.mock("@agent-native/core/server", () => ({ completeText: vi.fn() }));

import { extractJson } from "./llm";

describe("extractJson", () => {
  it("parses plain and fenced JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":"x"}\n```')).toEqual({ a: "x" });
  });
  it("survives raw newlines and tabs inside strings", () => {
    const raw =
      '{"status":"drafted","answer":"Line one.\n\nLine two\twith tab.","used":[]}';
    expect(extractJson<{ answer: string }>(raw)?.answer).toBe(
      "Line one.\n\nLine two\twith tab.",
    );
  });
  it("keeps escaped quotes intact", () => {
    expect(extractJson<{ a: string }>('{"a":"say \\"hi\\"\nnow"}')?.a).toBe(
      'say "hi"\nnow',
    );
  });
  it("returns null for junk", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });
});
