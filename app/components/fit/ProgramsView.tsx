import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowRight,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Rolling";

function daysLeft(iso: string | null): string | null {
  if (!iso) return null;
  const d = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  if (d < 0) return null;
  return d === 0 ? "closes today" : d === 1 ? "1 day left" : `${d} days left`;
}

export function ProgramsView({
  onStarted,
}: {
  onStarted: (id: string) => void;
}) {
  const q = useActionQuery("list-programs", {});
  const start = useActionMutation("start-application");
  const data = q.data;
  return (
    <div className="ff-doc">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="ff-title">Find a program</h1>
          <p className="ff-sub">
            Open programs ranked by deadline. Start one and Formfit creates the
            form with the name, link and deadline filled in.
          </p>
        </div>
        <button
          className="ff-btn"
          disabled={q.isFetching}
          onClick={() => q.refetch()}
          title="Reload (the list is cached for an hour)"
        >
          {q.isFetching ? (
            <IconLoader2 size={14} className="ff-spin" />
          ) : (
            <IconRefresh size={14} />
          )}
          Refresh
        </button>
      </div>
      {data?.note ? (
        <div className="ff-reason" style={{ marginLeft: 0, marginTop: 14 }}>
          {data.note}
        </div>
      ) : null}
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        {q.isLoading ? (
          <>
            <div className="ff-shimmer" style={{ height: 86 }} />
            <div className="ff-shimmer" style={{ height: 86 }} />
          </>
        ) : null}
        {data?.programs.map((p) => {
          const left = daysLeft(p.closesAt);
          return (
            <article key={p.id} className="ff-field ff-program">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="ff-label m-0">{p.title}</h3>
                <div
                  className="ff-help"
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  {p.organizer ? <span>{p.organizer}</span> : null}
                  {p.category ? (
                    <span className="ff-kind">{p.category}</span>
                  ) : null}
                  {p.status === "upcoming" ? (
                    <span className="ff-kind">upcoming</span>
                  ) : null}
                  {p.sourceUrl ? (
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{
                        display: "inline-flex",
                        gap: 3,
                        alignItems: "center",
                      }}
                    >
                      Details <IconExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="ff-program-meta tnum">
                <b>{p.money ?? "Amount not listed"}</b>
                <span>
                  {p.closesAt
                    ? `Closes ${fmtDate(p.closesAt)}`
                    : "Rolling deadline"}
                  {left ? ` · ${left}` : ""}
                </span>
              </div>
              <button
                className="ff-btn ff-btn-primary"
                disabled={start.isPending}
                onClick={() =>
                  start.mutate(
                    { programId: p.id },
                    {
                      onSuccess: (r) => onStarted(r.form.id),
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                {start.isPending && start.variables?.programId === p.id ? (
                  <IconLoader2 size={14} className="ff-spin" />
                ) : null}
                Start application <IconArrowRight size={14} />
              </button>
            </article>
          );
        })}
        {data && data.programs.length === 0 ? (
          <div className="ff-meta">No open programs right now.</div>
        ) : null}
      </div>
      {data ? (
        <p className="ff-meta" style={{ marginTop: 14 }}>
          Source:{" "}
          {data.source === "snapshot"
            ? "bundled snapshot"
            : `earnkit.com (${data.source})`}
          {" · "}updated {fmtDate(data.fetchedAt)}
        </p>
      ) : null}
    </div>
  );
}
