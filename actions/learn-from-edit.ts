import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { proposeFromEdit } from "../server/lib/formfit/learn.js";
import { getFieldDTO, getFormDTO } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Compare the founder's edited answer with the original draft and propose a bank update (a new fact, or improved phrasing for the source entry) as a before/after diff. Nothing is written to the bank until apply-bank-update accepts the proposal. Never learns from sensitive fields. Returns `proposal: null` with a note when there is nothing to learn.",
  schema: z.object({ fieldId: z.string() }),
  run: async ({ fieldId }) => {
    const field = await getFieldDTO(fieldId);
    if (!field)
      fail(`Field ${fieldId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const form = await getFormDTO(field.formId);
    const outcome = await proposeFromEdit(field, form?.title ?? "a form");
    return outcome.proposal
      ? { proposal: outcome.proposal, note: null }
      : { proposal: null, note: outcome.note };
  },
});
