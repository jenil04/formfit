import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { applyProposal } from "../server/lib/formfit/learn.js";

export default defineAction({
  description:
    "Accept (default) or dismiss a pending bank-update proposal from learn-from-edit. Accepting updates the answer bank: the entry's answer and/or its facts change, or a new entry is created.",
  schema: z.object({
    proposalId: z.string(),
    dismiss: z.boolean().optional().describe("Dismiss instead of applying"),
  }),
  run: async ({ proposalId, dismiss }) => applyProposal(proposalId, dismiss),
});
