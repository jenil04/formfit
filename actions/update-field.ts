import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getFieldDTO, patchFieldRow } from "../server/lib/formfit/store.js";
import { classifyField } from "../shared/classifier.js";
import { FIELD_KINDS } from "../shared/types.js";

export default defineAction({
  description:
    "Manually edit a field: set the `answer` (a changed answer becomes 'edited'; clearing it returns the field to empty/needs-you), mark it `ready` (status), or fix the parsed structure (label, help, kind, charLimit, wordLimit, required, options) when the import got something wrong. The UI's inline editor and the agent both use this.",
  schema: z.object({
    fieldId: z.string(),
    answer: z.string().optional(),
    status: z
      .enum(["ready", "unready"])
      .optional()
      .describe("'ready' marks it final; 'unready' reverts to edited/drafted"),
    label: z.string().optional(),
    help: z.string().optional(),
    kind: z.enum(FIELD_KINDS).optional(),
    charLimit: z.number().int().positive().nullable().optional(),
    wordLimit: z.number().int().positive().nullable().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  }),
  run: async (args) => {
    const f = await getFieldDTO(args.fieldId);
    if (!f)
      fail(`Field ${args.fieldId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const patch: Record<string, unknown> = {};
    if (args.label !== undefined) patch.label = args.label.trim();
    if (args.help !== undefined) patch.help = args.help;
    if (args.kind !== undefined) patch.kind = args.kind;
    if (args.charLimit !== undefined) patch.charLimit = args.charLimit;
    if (args.wordLimit !== undefined) patch.wordLimit = args.wordLimit;
    if (args.required !== undefined) patch.required = args.required ? 1 : 0;
    if (args.options !== undefined)
      patch.options = JSON.stringify(args.options);

    // Re-classify when structure changes so amber stays truthful.
    const label = args.label ?? f.label;
    const help = args.help ?? f.help;
    const kind = args.kind ?? f.kind;
    const c = classifyField({ label, help, kind });
    if (
      args.label !== undefined ||
      args.help !== undefined ||
      args.kind !== undefined
    ) {
      patch.sensitiveCategory = c.category;
    }
    const sensitive = c.sensitive || !!f.sensitiveCategory;

    const answer = args.answer !== undefined ? args.answer : f.answer;
    if (args.answer !== undefined) {
      patch.answer = args.answer;
      if (!args.answer.trim()) {
        patch.status = sensitive ? "needs_you" : "empty";
        patch.needsReason = sensitive ? (c.reason ?? f.needsReason) : null;
        patch.provenance = "[]";
      } else if (args.answer.trim() === f.draft.trim() && f.draft) {
        patch.status = f.status === "ready" ? "ready" : "drafted";
        patch.needsReason = null;
      } else {
        patch.status = "edited";
        patch.needsReason = null;
      }
    } else if (c.sensitive && !answer.trim() && args.label !== undefined) {
      patch.status = "needs_you";
      patch.needsReason = c.reason;
    }
    if (args.status === "ready") {
      if (!answer.trim())
        fail("Can't mark an empty field ready. Answer it first.", {
          errorCode: "invalid_request",
          statusCode: 400,
        });
      patch.status = "ready";
    } else if (args.status === "unready") {
      patch.status =
        answer.trim() === f.draft.trim() && f.draft ? "drafted" : "edited";
    }
    const field = await patchFieldRow(args.fieldId, patch);
    return { field };
  },
});
