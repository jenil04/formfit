import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { fillFields } from "../server/lib/formfit/fill.js";
import { getFormDTO } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Fill every safe field of a form from the answer bank (same logic as fill-field, one model call per field, fitted to each limit). Skips sensitive fields (they stay 'needs you'), and skips fields the founder already edited or marked ready unless `overwrite` is true. Returns a per-field summary.",
  schema: z.object({
    formId: z.string(),
    overwrite: z
      .boolean()
      .optional()
      .describe("Also redraft fields that are already drafted/edited/ready"),
  }),
  run: async ({ formId, overwrite }) => {
    const form = await getFormDTO(formId);
    if (!form)
      fail(`Form ${formId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const targets = form.fields.filter((f) => {
      if (f.sensitiveCategory) return false;
      if (overwrite) return true;
      return f.status === "empty" || f.status === "needs_you";
    });
    const results = await fillFields(targets.map((f) => f.id));
    const after = (await getFormDTO(formId))!;
    return {
      attempted: results.length,
      drafted: results.filter((r) => r.status === "drafted").length,
      needsYou: after.needsYou,
      skippedSensitive: form.fields.filter((f) => f.sensitiveCategory).length,
      results,
      form: after,
    };
  },
});
