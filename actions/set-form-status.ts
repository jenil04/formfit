import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { getFormDTO, nowIso } from "../server/lib/formfit/store.js";
import { FORM_STATUSES } from "../shared/types.js";

export default defineAction({
  description:
    "Set a form's status: draft, ready or submitted. 'ready' is refused while any required field is empty or still 'needs you' (the result lists them). 'submitted' records that the founder pasted it into the real form.",
  schema: z.object({
    formId: z.string(),
    status: z.enum(FORM_STATUSES),
  }),
  run: async ({ formId, status }) => {
    const form = await getFormDTO(formId);
    if (!form)
      fail(`Form ${formId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    if (status === "ready") {
      const blocking = form.fields.filter(
        (f) => f.required && (!f.answer.trim() || f.status === "needs_you"),
      );
      if (blocking.length) {
        throw new Error(
          `Can't mark ready: ${blocking.length} required field(s) still need an answer: ${blocking
            .map((f) => `#${f.position + 1} ${f.label}`)
            .join("; ")}`,
        );
      }
    }
    await getDb()
      .update(schema.forms)
      .set({ status, updatedAt: nowIso() })
      .where(eq(schema.forms.id, formId));
    return { form: await getFormDTO(formId) };
  },
});
