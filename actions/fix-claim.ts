import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { attachEvidence, removeClaim } from "../server/lib/formfit/claims.js";
import { getFieldDTO } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Fix one unsupported claim found by check-claims. mode 'rewrite' (default): the model rewrites the answer without that claim (no new facts; falls back to deleting the sentence). mode 'attach': the user vouches for it by attaching an evidence item (`evidenceId`) to that sentence. Returns the re-verified field.",
  schema: z.object({
    fieldId: z.string(),
    sentence: z
      .string()
      .describe("The unsupported sentence, exactly as in check-claims"),
    mode: z.enum(["rewrite", "attach"]).default("rewrite"),
    evidenceId: z.string().optional().describe("Required for mode 'attach'"),
  }),
  run: async ({ fieldId, sentence, mode, evidenceId }) => {
    const f = await getFieldDTO(fieldId);
    if (!f)
      fail(`Field ${fieldId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    if (mode === "attach") {
      if (!evidenceId)
        fail("Pick an evidence item to attach.", {
          errorCode: "invalid_request",
          statusCode: 400,
        });
      return { field: await attachEvidence(fieldId, sentence, evidenceId) };
    }
    const r = await removeClaim(fieldId, sentence);
    return { field: r.field, method: r.method };
  },
});
