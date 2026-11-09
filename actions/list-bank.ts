import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listBank } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "List every entry in the founder's answer bank: topic, canonical long answer and hard facts (key/value with a source note). This is the only source of truth for drafting form answers.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async () => {
    const entries = await listBank();
    return { count: entries.length, entries };
  },
});
