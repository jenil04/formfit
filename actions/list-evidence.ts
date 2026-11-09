import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listEvidence } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "List evidence items (commits, merged PRs, releases imported from GitHub), newest first, with dates and links. `fictional: true` marks the demo's sample set used when the GitHub import failed.",
  schema: z.object({
    repo: z.string().optional().describe("Filter to owner/repo"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ repo }) => ({ evidence: await listEvidence(repo) }),
});
