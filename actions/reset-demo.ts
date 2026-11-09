import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createForm, seedBank, wipeAll } from "../server/lib/formfit/store.js";
import { parseFormText } from "../shared/parser.js";
import { SAMPLE_FORMS } from "../shared/samples.js";

export default defineAction({
  description:
    "Reset the shared demo workspace: deletes all forms, fields, proposals and bank entries, then restores the demo founder's bank and loads the Lumen sample form, unfilled. Destructive: only use when the user asks to reset the demo.",
  schema: z.object({}),
  run: async () => {
    await wipeAll();
    const seeded = await seedBank();
    const sample = SAMPLE_FORMS[0]!;
    const form = await createForm({
      parsed: parseFormText(sample.text),
      sourceText: sample.text,
    });
    return { form, seededBankEntries: seeded };
  },
});
