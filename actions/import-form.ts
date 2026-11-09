import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { createForm } from "../server/lib/formfit/store.js";
import { parseFormText } from "../shared/parser.js";

export default defineAction({
  description:
    "Turn raw text pasted from any application page into a structured form: label, help, kind (short/long/url/email/select/number/date/checkbox), char or word limit, required. Deterministic parser; sensitive fields are flagged 'needs you' immediately. Refine afterwards with update-field (fix a wrong kind, limit or label).",
  schema: z.object({
    text: z.string().min(10).describe("Raw pasted form text"),
    title: z.string().optional().describe("Override the detected form title"),
  }),
  run: async ({ text, title }) => {
    const parsed = parseFormText(text);
    if (parsed.fields.length === 0) {
      fail(
        "No fields found. Paste the form text including its labels (and limits like '(max 500 characters)').",
        { errorCode: "invalid_request", statusCode: 400 },
      );
    }
    const form = await createForm({ parsed, sourceText: text, title });
    return { form };
  },
});
