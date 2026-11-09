import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import {
  addFieldsToForm,
  createForm,
  getFormDTO,
} from "../server/lib/formfit/store.js";
import { parseFormText } from "../shared/parser.js";

export default defineAction({
  description:
    "Turn raw text pasted from any application page into a structured form: label, help, kind (short/long/url/email/select/number/date/checkbox), char or word limit, required. Deterministic parser; sensitive fields are flagged 'needs you' immediately. Refine afterwards with update-field (fix a wrong kind, limit or label).",
  schema: z.object({
    text: z.string().min(10).describe("Raw pasted form text"),
    title: z.string().optional().describe("Override the detected form title"),
    formId: z
      .string()
      .optional()
      .describe(
        "Add the parsed fields to this existing form (e.g. one started from a program) instead of creating a new one",
      ),
  }),
  run: async ({ text, title, formId }) => {
    const parsed = parseFormText(text);
    if (parsed.fields.length === 0) {
      fail(
        "No fields found. Paste the form text including its labels (and limits like '(max 500 characters)').",
        { errorCode: "invalid_request", statusCode: 400 },
      );
    }
    if (formId) {
      if (!(await getFormDTO(formId)))
        fail(`Form ${formId} not found`, {
          errorCode: "invalid_request",
          statusCode: 400,
        });
      return { form: await addFieldsToForm(formId, parsed, text) };
    }
    const form = await createForm({ parsed, sourceText: text, title });
    return { form };
  },
});
