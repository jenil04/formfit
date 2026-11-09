import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { refreshClaims } from "../server/lib/formfit/claims.js";
import { getFieldDTO } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Re-verify a field's text. Every sentence that says something was built/shipped/launched/integrated must be backed by a cited evidence item (commit/PR/release) or a bank fact. A deterministic pre-check (claim verbs + keyword overlap with evidence titles and bank entries) clears the clear cases; one LLM judgment handles only the ambiguous ones and may cite only real, overlapping sources. Unsupported sentences come back with `supported: false` and a reason like \"No commit or bank fact backs 'integrated Stripe'\" (shown amber, with a Fix). Run automatically after a manual edit.",
  schema: z.object({
    fieldId: z.string(),
    llm: z
      .boolean()
      .optional()
      .describe("Use the model for ambiguous sentences (default true)"),
  }),
  run: async ({ fieldId, llm }) => {
    const f = await getFieldDTO(fieldId);
    if (!f)
      fail(`Field ${fieldId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const { field, llmCalls } = await refreshClaims(fieldId, {
      useLlm: llm ?? true,
    });
    return {
      field,
      claims: field.claims,
      unsupported: field.claims.filter((c) => !c.supported).length,
      llmCalls,
    };
  },
});
