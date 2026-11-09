import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { draftAndSave } from "../server/lib/formfit/fill.js";
import { getFieldDTO, listBank } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Draft (or redraft) one field from the answer bank with the LLM, fitted to the exact char/word limit (counted server-side; never exceeds). Numbers, dates, names and claims come only from the bank; if the bank lacks them the field becomes 'needs you' with a reason. Sensitive fields are never drafted. Use `instruction` for 'make it punchier' and `targetChars` for 'fit this to 280' (tighter than the form's own limit, which stays unchanged).",
  schema: z.object({
    fieldId: z.string(),
    instruction: z.string().optional().describe("e.g. 'make it punchier'"),
    targetChars: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Tighter character target for this draft"),
  }),
  run: async ({ fieldId, instruction, targetChars }) => {
    const bank = await listBank();
    const result = await draftAndSave(fieldId, bank, {
      instruction,
      targetChars,
    });
    return { result, field: await getFieldDTO(fieldId) };
  },
});
