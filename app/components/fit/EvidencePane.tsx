import { useActionMutation } from "@agent-native/core/client/hooks";
import { DEFAULT_EVIDENCE_REPO } from "@shared/seed-evidence";
import { IconBrandGithub, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import type { EvidenceDTO } from "../../../server/lib/formfit/store";
import { EvidenceIcon } from "./CitationChip";

const KIND_LABEL: Record<string, string> = {
  commit: "Commit",
  pr: "Merged PR",
  release: "Release",
};

const fmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

export function EvidencePane({
  evidence,
  loading,
}: {
  evidence: EvidenceDTO[];
  loading: boolean;
}) {
  const [repo, setRepo] = useState(DEFAULT_EVIDENCE_REPO);
  const imp = useActionMutation("import-github-evidence");
  const run = () =>
    imp.mutate(
      { repo },
      {
        onSuccess: (r) => {
          toast.success(
            `${r.repo}: ${r.commits} commits, ${r.prs} PRs, ${r.releases} releases`,
          );
          for (const w of r.warnings) toast.warning(w, { duration: 8000 });
        },
        onError: (e) => toast.error(e.message, { duration: 8000 }),
      },
    );
  return (
    <>
      <form
        className="ff-ev-import"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="ff-section-label" htmlFor="ff-ev-repo">
          Import evidence from a public repo
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            id="ff-ev-repo"
            className="ff-input"
            style={{ height: 30, fontSize: 12.5, flex: 1, minWidth: 0 }}
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="https://github.com/owner/repo"
            spellCheck={false}
          />
          <button
            className="ff-btn ff-btn-primary ff-btn-sm"
            style={{ height: 30 }}
            disabled={imp.isPending || !repo.trim()}
            type="submit"
          >
            {imp.isPending ? (
              <IconLoader2 size={13} className="ff-spin" />
            ) : (
              <IconBrandGithub size={13} />
            )}
            Import
          </button>
        </div>
      </form>
      <div className="ff-bank-scroll">
        {loading && evidence.length === 0 ? (
          <div className="ff-shimmer" style={{ height: 70 }} />
        ) : null}
        {!loading && evidence.length === 0 ? (
          <div
            className="ff-entry"
            style={{ borderStyle: "dashed", textAlign: "center", padding: 18 }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>No evidence yet</div>
            <div className="ff-meta" style={{ marginTop: 4, lineHeight: 1.5 }}>
              Import a repo and drafts can cite real commits, merged PRs and
              releases. Claims with no source turn amber.
            </div>
          </div>
        ) : null}
        {evidence.map((e) => (
          <div key={e.id} className="ff-ev">
            <div className="ff-ev-top">
              <span className={`ff-ev-kind k-${e.kind}`}>
                <EvidenceIcon kind={e.kind} size={12} />
                {KIND_LABEL[e.kind] ?? e.kind}
              </span>
              {e.sha ? <code className="ff-ev-sha">{e.sha}</code> : null}
              <span style={{ flex: 1 }} />
              <time className="ff-meta tnum" dateTime={e.date}>
                {fmt(e.date)}
              </time>
            </div>
            <div className="ff-ev-title">
              {e.url ? (
                <a href={e.url} target="_blank" rel="noreferrer noopener">
                  {e.title}
                </a>
              ) : (
                e.title
              )}
            </div>
            <div className="ff-meta">
              {e.repo}
              {e.fictional ? " · sample data (import failed)" : ""}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
