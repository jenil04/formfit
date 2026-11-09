import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { removeEvidence } from "../server/lib/formfit/store.js";

export default defineAction({
  description:
    "Remove all imported evidence for one repo (owner/repo). Drafts that cited it keep their text; run check-claims to re-verify them.",
  schema: z.object({ repo: z.string() }),
  run: async ({ repo }) => ({ removed: await removeEvidence(repo) }),
});
