import { describe, expect, it } from "vitest";

import {
  mapCommit,
  mapPull,
  mapRelease,
  parseRepoRef,
  readRateLimit,
} from "./github.js";
import { normalizePrograms, rankByDeadline } from "./programs.js";

describe("parseRepoRef", () => {
  it("parses urls and slugs", () => {
    expect(parseRepoRef("https://github.com/jenil04/formfit")?.slug).toBe(
      "jenil04/formfit",
    );
    expect(parseRepoRef("https://github.com/jenil04/formfit.git/")?.slug).toBe(
      "jenil04/formfit",
    );
    expect(parseRepoRef("github.com/a/b/tree/main")?.slug).toBe("a/b");
    expect(parseRepoRef("a/b.c")?.slug).toBe("a/b.c");
  });
  it("rejects anything else", () => {
    for (const s of [
      "",
      "https://gitlab.com/a/b",
      "https://github.com/a",
      "https://evil.com/github.com/a/b",
      "a/b/c/d",
    ])
      expect(parseRepoRef(s), s).toBeNull();
  });
});

describe("github mappers", () => {
  it("maps commits, skipping merge commits", () => {
    const e = mapCommit("o/r", {
      sha: "abcdef123456",
      html_url: "u",
      commit: {
        message: "Add x\n\nbody",
        author: { date: "2026-01-01T00:00:00Z" },
      },
    });
    expect(e).toMatchObject({
      kind: "commit",
      title: "Add x",
      sha: "abcdef1",
      id: "commit:o/r:abcdef123456",
    });
    expect(
      mapCommit("o/r", {
        sha: "1",
        commit: { message: "Merge pull request #1 from a/b" },
      }),
    ).toBeNull();
  });
  it("keeps merged PRs only", () => {
    expect(
      mapPull("o/r", { number: 3, title: "T", merged_at: null }),
    ).toBeNull();
    expect(
      mapPull("o/r", {
        number: 3,
        title: "T",
        merged_at: "2026-01-02T00:00:00Z",
        html_url: "u",
      }),
    ).toMatchObject({ kind: "pr", sha: "#3" });
  });
  it("maps releases and skips drafts", () => {
    expect(
      mapRelease("o/r", {
        tag_name: "v1",
        name: "First",
        published_at: "2026-01-03T00:00:00Z",
      })?.title,
    ).toBe("v1 First");
    expect(mapRelease("o/r", { tag_name: "v2", draft: true })).toBeNull();
  });
});

describe("rate limit", () => {
  const h = (o: Record<string, string>) => ({
    get: (n: string) => o[n] ?? null,
  });
  it("detects a primary limit", () => {
    const r = readRateLimit(
      403,
      h({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" }),
      false,
    );
    expect(r.limited).toBe(true);
    expect(r.message).toContain("GITHUB_TOKEN");
  });
  it("does not treat a plain 403 as a limit", () => {
    expect(
      readRateLimit(403, h({ "x-ratelimit-remaining": "50" }), true).limited,
    ).toBe(false);
  });
});

describe("programs", () => {
  it("normalises and ranks by deadline, rolling last, closed dropped", () => {
    const now = Date.parse("2026-11-09T00:00:00Z");
    const list = normalizePrograms({
      ok: true,
      programs: [
        { id: "c", title: "Rolling", status: "active", closes_at: null },
        {
          id: "b",
          title: "Later",
          status: "upcoming",
          closes_at: "2026-12-01T00:00:00Z",
          money: "$1K",
        },
        {
          id: "a",
          title: "Soon",
          status: "active",
          closes_at: "2026-11-10T00:00:00Z",
        },
        {
          id: "x",
          title: "Past",
          status: "active",
          closes_at: "2026-10-01T00:00:00Z",
        },
        { title: "no id" },
      ],
    });
    expect(rankByDeadline(list, now).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});
