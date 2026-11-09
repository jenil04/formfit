import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadPrograms } from "../server/lib/formfit/programs.js";

export default defineAction({
  description:
    "List open programs (grants, hackathons, accelerators) ranked by deadline with the money on offer. Reads ONLY the public read-only endpoint GET https://earnkit.com/api/programs; cached for 1 hour; falls back to a small bundled snapshot if it fails (`source` says which). This is the 'find' step; use start-application to begin one.",
  schema: z.object({
    refresh: z.boolean().optional().describe("Bypass the 1-hour cache"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ refresh }) => loadPrograms(refresh),
});
