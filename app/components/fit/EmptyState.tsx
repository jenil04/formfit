import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconArrowRight, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

export function EmptyState({
  onCreated,
  onPaste,
}: {
  onCreated: (formId: string) => void;
  onPaste: () => void;
}) {
  const load = useActionMutation("load-sample");
  return (
    <div className="ff-hero ff-rise">
      <span className="ff-chip ff-chip-drafted">
        The agent drafts · you edit · it learns
      </span>
      <h1>Your answer bank, fitted to every form.</h1>
      <p>
        Keep your best answers once. Paste any application, and Formfit drafts
        each field from your bank, fitted to the exact character limit. It never
        invents a number, and it hands you the fields only you can answer.
      </p>
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          marginTop: 26,
        }}
      >
        <button
          className="ff-btn ff-btn-primary"
          style={{
            height: 40,
            padding: "0 18px",
            fontSize: 14,
            borderRadius: 10,
          }}
          disabled={load.isPending}
          onClick={() =>
            load.mutate(
              { sampleId: "lumen-accelerator" },
              {
                onSuccess: (r) => onCreated(r.form.id),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          {load.isPending ? (
            <IconLoader2 size={16} className="ff-spin" />
          ) : null}
          Load sample founder + form
          <IconArrowRight size={15} />
        </button>
        <button
          className="ff-btn"
          style={{
            height: 40,
            padding: "0 16px",
            fontSize: 14,
            borderRadius: 10,
          }}
          onClick={onPaste}
        >
          Paste your own form
        </button>
      </div>
      <div className="ff-steps">
        <div className="ff-step">
          <b>1 · Bank</b>Topics, canonical answers, hard facts with sources.
        </div>
        <div className="ff-step">
          <b>2 · Fit</b>Fields are drafted to each limit, with chips showing
          which facts they used.
        </div>
        <div className="ff-step">
          <b>3 · Learn</b>Edit a draft and Formfit proposes a bank update you
          accept in one click.
        </div>
      </div>
    </div>
  );
}
