import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listFormSummaries } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "List imported forms with status (draft/ready/submitted), field count and how many fields need the founder.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async () => ({ forms: await listFormSummaries() }),
});
