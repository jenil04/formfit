import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { deleteForm } from "../server/lib/formfit/store.js";

export default defineAction({
  description: "Delete a form and its fields.",
  schema: z.object({ formId: z.string() }),
  run: async ({ formId }) => {
    await deleteForm(formId);
    return { deleted: true, formId };
  },
});
