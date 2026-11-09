import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getFormDTO } from "../server/lib/formfit/store.js";
import { measure } from "../shared/fit.js";

export default defineAction({
  description:
    "Produce the copy-paste packet for a form: each field's label, answer, char count vs limit and status, plus a plain-text rendering. Fields that still need the founder are listed under `todo`. Read-only.",
  schema: z.object({ formId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ formId }) => {
    const form = await getFormDTO(formId);
    if (!form)
      fail(`Form ${formId} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const rows = form.fields.map((f) => {
      const m = measure(f.answer, f);
      return {
        n: f.position + 1,
        label: f.label,
        answer: f.answer,
        chars: m.chars,
        charLimit: f.charLimit,
        wordLimit: f.wordLimit,
        words: m.words,
        status: f.status,
        required: f.required,
        overLimit: m.over,
        reason: f.status === "needs_you" ? f.needsReason : null,
        sources: f.citations.map((c) => ({
          label: c.label,
          url: c.url ?? null,
        })),
        unsupportedClaims: f.claims
          .filter((c) => !c.supported)
          .map((c) => c.sentence),
      };
    });
    const todo = rows.filter(
      (r) => r.status === "needs_you" || (r.required && !r.answer.trim()),
    );
    const text = [
      `${form.title} (${form.status})`,
      "",
      ...rows.map((r) => {
        const limit = r.charLimit
          ? ` [${r.chars}/${r.charLimit} chars]`
          : r.wordLimit
            ? ` [${r.words}/${r.wordLimit} words]`
            : r.chars
              ? ` [${r.chars} chars]`
              : "";
        const body = r.answer.trim()
          ? r.answer
          : `(NEEDS YOU${r.reason ? `: ${r.reason}` : ""})`;
        return `${r.n}. ${r.label}${r.required ? " *" : ""}${limit}\n${body}\n`;
      }),
    ].join("\n");
    const sources = [
      ...new Map(
        form.fields.flatMap((f) => f.citations).map((c) => [c.id, c]),
      ).values(),
    ];
    const warnings = rows.flatMap((r) =>
      r.unsupportedClaims.map(
        (s) => `#${r.n}: no commit or bank fact backs "${s}"`,
      ),
    );
    const fullText = [
      text,
      warnings.length
        ? `WARNINGS (unsupported claims, fix before submitting)\n${warnings.map((w) => `- ${w}`).join("\n")}\n`
        : "",
      sources.length
        ? `EVIDENCE CITED\n${sources.map((c) => `- ${c.label}${c.url ? ` ${c.url}` : ""}`).join("\n")}\n`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      formId,
      title: form.title,
      status: form.status,
      needsYou: form.needsYou,
      rows,
      todo: todo.map((r) => ({ n: r.n, label: r.label, reason: r.reason })),
      warnings,
      sources,
      text: fullText,
    };
  },
});
