import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconBulb, IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";

import { wordDiff } from "@/lib/diff";

import type { ProposalDTO } from "../../../server/lib/formfit/store";

export function ProposalCard({
  proposal,
  onApplied,
}: {
  proposal: ProposalDTO;
  onApplied: (entryId: string | null) => void;
}) {
  const apply = useActionMutation("apply-bank-update");
  const changed = proposal.afterAnswer.trim() !== proposal.beforeAnswer.trim();
  const parts =
    changed && proposal.beforeAnswer
      ? wordDiff(proposal.beforeAnswer, proposal.afterAnswer)
      : null;

  const act = (dismiss: boolean) =>
    apply.mutate(
      { proposalId: proposal.id, ...(dismiss ? { dismiss: true } : {}) },
      {
        onSuccess: (r) => {
          if (!dismiss) {
            toast.success(`Bank updated: ${r.entry?.topic ?? proposal.topic}`);
            onApplied(r.entry?.id ?? null);
          }
        },
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <div
      className="ff-learn ff-rise"
      role="region"
      aria-label="Suggested bank update"
    >
      <h4>
        <IconBulb size={14} /> Learn from your edit · {proposal.summary}
      </h4>
      <div className="ff-diff">
        {proposal.newFacts.map((f) => (
          <div key={f.key} className="ff-diff-fact">
            + fact · {f.key}: {f.value}
          </div>
        ))}
        {parts ? (
          <div style={{ marginTop: proposal.newFacts.length ? 6 : 0 }}>
            {parts.map((p, i) =>
              p.type === "add" ? (
                <ins key={i}>{p.text} </ins>
              ) : p.type === "del" ? (
                <del key={i}>{p.text} </del>
              ) : (
                <span key={i}>{p.text} </span>
              ),
            )}
          </div>
        ) : changed ? (
          <div>
            <ins>{proposal.afterAnswer}</ins>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button
          className="ff-btn ff-btn-primary ff-btn-sm"
          disabled={apply.isPending}
          onClick={() => act(false)}
        >
          <IconCheck size={13} /> Add to bank
        </button>
        <button
          className="ff-btn ff-btn-ghost ff-btn-sm"
          disabled={apply.isPending}
          onClick={() => act(true)}
        >
          <IconX size={13} /> Dismiss
        </button>
      </div>
    </div>
  );
}
