import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getFieldDTO } from "../server/lib/formfit/store.js";
import { classifyField } from "../shared/classifier.js";
import { FIELD_KINDS } from "../shared/types.js";

export default defineAction({
  description:
    "Explain whether a field is one only the human can answer (wallet/payout address, phone, government ID/KYC, tax ID, home address, date of birth, bank/card, legal consent/signature, equity/investment terms, references' contact info). Pass `fieldId` to classify a stored field and see its current status and reason (use this to answer 'why is #7 amber?'), or pass label/help/kind. Read-only and deterministic.",
  schema: z.object({
    fieldId: z.string().optional(),
    label: z.string().optional(),
    help: z.string().optional(),
    kind: z.enum(FIELD_KINDS).optional(),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ fieldId, label, help, kind }) => {
    if (fieldId) {
      const f = await getFieldDTO(fieldId);
      if (!f)
        fail(`Field ${fieldId} not found`, {
          errorCode: "invalid_request",
          statusCode: 400,
        });
      const c = classifyField(f);
      return {
        fieldId,
        label: f.label,
        status: f.status,
        ...c,
        // A field can be amber because the bank lacks the answer, not because it is sensitive.
        statusReason: f.needsReason,
      };
    }
    if (!label)
      fail("Pass fieldId, or label (and optionally help/kind).", {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    return { label, ...classifyField({ label, help, kind }) };
  },
});
