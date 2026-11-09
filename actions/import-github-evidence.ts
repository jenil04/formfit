import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { fetchGithubEvidence } from "../server/lib/formfit/github.js";
import { saveEvidence } from "../server/lib/formfit/store.js";
import { MAX_COMMITS, parseRepoRef } from "../shared/github.js";

export default defineAction({
  description:
    "Import real shipped work from a PUBLIC GitHub repo as evidence: recent commits (max 100), merged PRs and releases, via the unauthenticated GitHub REST API (GITHUB_TOKEN is used only if set). Stored as evidence items (kind commit/pr/release, title, date, url, short sha); re-importing refreshes instead of duplicating. Drafting and check-claims cite these. Handles GitHub rate limits with a clear message and keeps partial results.",
  schema: z.object({
    repo: z
      .string()
      .describe("Public repo: https://github.com/owner/repo or owner/repo"),
    maxCommits: z
      .number()
      .int()
      .min(1)
      .max(MAX_COMMITS)
      .optional()
      .describe("How many recent commits to fetch (default and max 100)"),
  }),
  run: async ({ repo, maxCommits }) => {
    const ref = parseRepoRef(repo);
    if (!ref)
      fail("Enter a public GitHub repo as https://github.com/owner/repo", {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const got = await fetchGithubEvidence(ref, maxCommits ?? MAX_COMMITS);
    const saved = await saveEvidence(got.items);
    return {
      repo: ref.slug,
      ...got.counts,
      added: saved.added,
      updated: saved.updated,
      warnings: got.warnings,
    };
  },
});
