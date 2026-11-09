import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { seedEvidence } from "../server/lib/formfit/seed-evidence.js";
import { createForm, listBank, seedBank } from "../server/lib/formfit/store.js";
import { parseFormText } from "../shared/parser.js";
import { SAMPLE_FORMS } from "../shared/samples.js";

export default defineAction({
  description:
    "Load a sample: seeds the demo founder's answer bank if it is empty (fictional startup 'Tidewell'), seeds evidence if none exists (real commits from the default public repo; a small fictional set only if that import fails), and imports one of two fictional sample forms ('lumen-accelerator' or 'northwind-builders'). One click for first-run.",
  schema: z.object({
    sampleId: z
      .enum(["lumen-accelerator", "northwind-builders"])
      .default("lumen-accelerator"),
  }),
  run: async ({ sampleId }) => {
    const sample = SAMPLE_FORMS.find((s) => s.id === sampleId)!;
    const seeded = (await listBank()).length === 0 ? await seedBank() : 0;
    const evidence = await seedEvidence();
    const form = await createForm({
      parsed: parseFormText(sample.text),
      sourceText: sample.text,
    });
    return { form, seededBankEntries: seeded, evidence };
  },
});
