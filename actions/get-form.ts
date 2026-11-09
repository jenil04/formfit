import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getFormDTO } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Get one form with all fields (status, answer, char count vs limit, provenance, needs-you reason) and pending bank-update proposals.",
  schema: z.object({ id: z.string().describe("Form id") }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ id }) => {
    const form = await getFormDTO(id);
    if (!form)
      fail(`Form ${id} not found`, {
        errorCode: "invalid_request",
        statusCode: 400,
      });
    return { form };
  },
});
