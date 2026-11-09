import {
  IconDatabase,
  IconExternalLink,
  IconGitCommit,
  IconGitPullRequest,
  IconTag,
} from "@tabler/icons-react";

import type { Citation } from "@shared/types";

export function EvidenceIcon({
  kind,
  size = 11,
}: {
  kind: string;
  size?: number;
}) {
  if (kind === "pr") return <IconGitPullRequest size={size} stroke={2.2} />;
  if (kind === "release") return <IconTag size={size} stroke={2.2} />;
  if (kind === "commit") return <IconGitCommit size={size} stroke={2.2} />;
  return <IconDatabase size={size} stroke={2.2} />;
}

/** A commit / PR / release links out; a bank entry lights up in the bank pane. */
export function CitationChip({
  c,
  onBank,
}: {
  c: Citation;
  onBank?: (entryId: string) => void;
}) {
  if (c.kind === "bank")
    return (
      <button
        type="button"
        className="ff-prov"
        title="Show this in your bank"
        onClick={(e) => {
          e.stopPropagation();
          onBank?.(c.id);
        }}
      >
        <EvidenceIcon kind="bank" />
        {c.label}
      </button>
    );
  const body = (
    <>
      <EvidenceIcon kind={c.kind} />
      {c.label}
      {c.url ? <IconExternalLink size={10} /> : null}
    </>
  );
  return c.url ? (
    <a
      className="ff-prov ff-prov-ev"
      href={c.url}
      target="_blank"
      rel="noreferrer noopener"
      title={`Open ${c.kind} on GitHub`}
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </a>
  ) : (
    <span className="ff-prov ff-prov-ev" title={`${c.kind} (sample, no link)`}>
      {body}
    </span>
  );
}
