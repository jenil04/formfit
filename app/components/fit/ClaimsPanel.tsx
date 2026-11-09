import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import type { ClaimResult } from "@shared/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconPaperclip,
  IconWand,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { CitationChip } from "./CitationChip";

/** Every claim sentence with its citation chips; unsupported ones are amber with a one-click Fix. */
export function ClaimsPanel({
  fieldId,
  claims,
  checking,
  onBank,
}: {
  fieldId: string;
  claims: ClaimResult[];
  checking: boolean;
  onBank: (entryId: string) => void;
}) {
  if (claims.length === 0 && !checking) return null;
  return (
    <div className="ff-claims" aria-label="Claims and their sources">
      {checking ? (
        <div className="ff-meta" role="status">
          <IconLoader2 size={12} className="ff-spin" /> Checking claims against
          your evidence…
        </div>
      ) : null}
      {claims.map((c) =>
        c.supported ? (
          <div key={c.sentence} className="ff-claim">
            <IconCheck size={12} stroke={2.4} className="ff-claim-ok" />
            <span className="ff-claim-text">{c.sentence}</span>
            {c.citations.map((cc) => (
              <CitationChip
                key={`${cc.kind}:${cc.id}`}
                c={cc}
                onBank={onBank}
              />
            ))}
          </div>
        ) : (
          <UnsupportedClaim key={c.sentence} fieldId={fieldId} claim={c} />
        ),
      )}
    </div>
  );
}

function UnsupportedClaim({
  fieldId,
  claim,
}: {
  fieldId: string;
  claim: ClaimResult;
}) {
  const fix = useActionMutation("fix-claim");
  const [attaching, setAttaching] = useState(false);
  const evQ = useActionQuery("list-evidence", {}, { enabled: attaching });
  const [pick, setPick] = useState("");
  const suggested = new Set((claim.suggestions ?? []).map((s) => s.id));
  const all = evQ.data?.evidence ?? [];
  const ordered = [
    ...all.filter((e) => suggested.has(e.id)),
    ...all.filter((e) => !suggested.has(e.id)).slice(0, 60),
  ];
  const run = (vars: { mode: "rewrite" | "attach"; evidenceId?: string }) =>
    fix.mutate(
      { fieldId, sentence: claim.sentence, ...vars },
      {
        onSuccess: () => setAttaching(false),
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <div className="ff-claim is-unsupported" role="note">
      <IconAlertTriangle size={14} className="ff-claim-warn" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ff-claim-text">
          <mark>{claim.sentence}</mark>
        </div>
        <div className="ff-claim-reason">
          {claim.reason ?? "No commit or bank fact backs this."}
        </div>
        <div className="ff-claim-actions">
          <button
            type="button"
            className="ff-btn ff-btn-sm ff-btn-primary"
            disabled={fix.isPending}
            onClick={(e) => {
              e.stopPropagation();
              run({ mode: "rewrite" });
            }}
            title="The agent rewrites the answer without this claim"
          >
            {fix.isPending ? (
              <IconLoader2 size={12} className="ff-spin" />
            ) : (
              <IconWand size={12} />
            )}
            Fix
          </button>
          <button
            type="button"
            className="ff-btn ff-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setAttaching((v) => !v);
            }}
          >
            <IconPaperclip size={12} /> Attach evidence
          </button>
        </div>
        {attaching ? (
          <div
            className="ff-claim-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <select
              className="ff-input"
              style={{ height: 28, fontSize: 12, flex: 1, minWidth: 0 }}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label="Evidence that backs this claim"
            >
              <option value="">
                {evQ.isLoading ? "Loading…" : "Choose a commit, PR or release…"}
              </option>
              {ordered.map((e) => (
                <option key={e.id} value={e.id}>
                  {suggested.has(e.id) ? "★ " : ""}
                  {e.sha ? `${e.sha} · ` : ""}
                  {e.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ff-btn ff-btn-sm ff-btn-primary"
              disabled={!pick || fix.isPending}
              onClick={() => run({ mode: "attach", evidenceId: pick })}
            >
              Attach
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
