import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { removeBankEntry } from "../server/lib/formfit/store.js";

export default defineAction({
  description: "Delete an answer-bank entry by id.",
  schema: z.object({ id: z.string() }),
  run: async ({ id }) => {
    const deleted = await removeBankEntry(id);
    if (!deleted)
      fail(`Bank entry ${id} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    return { deleted: true, id };
  },
});
