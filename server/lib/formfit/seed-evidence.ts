import { parseRepoRef } from "../../../shared/github.js";
import {
  DEFAULT_EVIDENCE_REPO,
  SAMPLE_EVIDENCE,
} from "../../../shared/seed-evidence.js";
import { fetchGithubEvidence } from "./github.js";
import { listEvidence, saveEvidence } from "./store.js";

/**
 * Demo seed: real evidence from the default public repo; the small fictional
 * set only if that import fails. No-op when evidence already exists.
 */
export async function seedEvidence(): Promise<{
  source: "github" | "sample" | "existing";
  added: number;
  note: string | null;
}> {
  if ((await listEvidence()).length > 0)
    return { source: "existing", added: 0, note: null };
  try {
    const got = await fetchGithubEvidence(
      parseRepoRef(DEFAULT_EVIDENCE_REPO)!,
      50,
    );
    if (got.items.length === 0) throw new Error("no commits found");
    const r = await saveEvidence(got.items);
    return { source: "github", added: r.added, note: null };
  } catch (e) {
    const r = await saveEvidence(SAMPLE_EVIDENCE, true);
    return {
      source: "sample",
      added: r.added,
      note: `GitHub import failed (${e instanceof Error ? e.message : "error"}); loaded a small fictional sample set.`,
    };
  }
}
