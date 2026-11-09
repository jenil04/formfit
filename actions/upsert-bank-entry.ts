import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { saveBankEntry } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Create or update an answer-bank entry. Pass `id` to update. `facts` replaces the entry's hard facts (key/value with an optional source note). Only put things the founder has stated; never invent figures.",
  schema: z.object({
    id: z.string().optional().describe("Existing entry id to update"),
    topic: z.string().min(1).describe('Short topic, e.g. "traction", "team"'),
    title: z.string().optional(),
    answer: z.string().describe("Canonical long answer"),
    facts: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
          source: z.string().optional(),
        }),
      )
      .optional(),
  }),
  run: async (args) => ({ entry: await saveBankEntry(args) }),
});
