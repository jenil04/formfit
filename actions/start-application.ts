import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getProgram } from "../server/lib/formfit/programs.js";
import { createForm } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Start an application from a program found with list-programs: creates a form prefilled with the program name, submission URL, deadline and money. The form has no fields yet; the user pastes the form's text next (import-form with this formId adds the fields).",
  schema: z.object({
    programId: z.string().describe("Program id from list-programs"),
  }),
  run: async ({ programId }) => {
    const p = await getProgram(programId);
    if (!p)
      fail(`Program ${programId} isn't in the current list.`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    const form = await createForm({
      parsed: {
        title: p.title,
        description: [p.organizer, p.money].filter(Boolean).join(" · "),
        fields: [],
      },
      sourceText: "",
      program: {
        programId: p.id,
        organizer: p.organizer || null,
        money: p.money,
        deadline: p.closesAt,
        sourceUrl: p.submissionUrl ?? p.sourceUrl,
      },
    });
    return { form };
  },
});
