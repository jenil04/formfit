import { useActionMutation } from "@agent-native/core/client/hooks";
import { measure } from "@shared/fit";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconDatabase,
  IconLoader2,
  IconPencil,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { FieldDTO } from "../../../server/lib/formfit/store";

const STATUS_LABEL: Record<string, string> = {
  empty: "Empty",
  drafted: "Drafted",
  needs_you: "Needs you",
  edited: "Edited",
  ready: "Ready",
};

export function StatusChip({ status }: { status: string }) {
  const Icon =
    status === "needs_you"
      ? IconAlertTriangle
      : status === "ready"
        ? IconCheck
        : status === "edited"
          ? IconPencil
          : status === "drafted"
            ? IconSparkles
            : null;
  return (
    <span className={`ff-chip ff-chip-${status}`}>
      {Icon ? <Icon size={12} stroke={2.2} /> : null}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function limitLabel(f: Pick<FieldDTO, "charLimit" | "wordLimit">) {
  if (f.charLimit) return `max ${f.charLimit} chars`;
  if (f.wordLimit) return `max ${f.wordLimit} words`;
  return null;
}

interface Props {
  field: FieldDTO;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
  onProvenanceClick: (entryId: string) => void;
}

export function FieldCard({
  field,
  selected,
  pending,
  onSelect,
  onProvenanceClick,
}: Props) {
  const [value, setValue] = useState(field.answer);
  const [focused, setFocused] = useState(false);
  const [fresh, setFresh] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const prevAnswer = useRef(field.answer);

  const update = useActionMutation("update-field");
  const refit = useActionMutation("fill-field");
  const learn = useActionMutation("learn-from-edit");

  // Pull in server changes (agent edits, fills) unless the user is typing.
  useEffect(() => {
    if (!focused) setValue(field.answer);
    if (
      !prevAnswer.current.trim() &&
      field.answer.trim() &&
      field.status === "drafted"
    ) {
      setFresh(true);
      const t = setTimeout(() => setFresh(false), 1100);
      prevAnswer.current = field.answer;
      return () => clearTimeout(t);
    }
    prevAnswer.current = field.answer;
  }, [field.answer, field.status, focused]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, pending]);

  const live = measure(value, field);
  const limit = limitLabel(field);
  const refitting = refit.isPending;
  const busy = pending || refitting;
  const isSelect = field.kind === "select" && field.options.length > 0;

  const commit = (next: string) => {
    if (next === field.answer) return;
    update.mutate(
      { fieldId: field.id, answer: next },
      {
        onSuccess: () => {
          // A changed draft is a lesson: ask for a bank update, silently.
          if (
            field.draft &&
            next.trim() &&
            next.trim() !== field.draft.trim()
          ) {
            learn.mutate({ fieldId: field.id });
          } else if (!field.draft && next.trim() && !field.sensitiveCategory) {
            learn.mutate({ fieldId: field.id });
          }
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const copy = async () => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    toast.success(`Copied #${field.position + 1}`, { duration: 1400 });
  };

  const redraft = (instruction?: string) =>
    refit.mutate(
      { fieldId: field.id, ...(instruction ? { instruction } : {}) },
      { onError: (e) => toast.error(e.message) },
    );

  const needs = field.status === "needs_you";
  const cls = [
    "ff-field",
    selected && "is-selected",
    needs && "is-needs",
    fresh && "is-fresh",
    busy && "is-pending",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      id={`field-${field.id}`}
      className={cls}
      onClick={onSelect}
      aria-label={`Field ${field.position + 1}: ${field.label}`}
    >
      <header className="ff-field-head">
        <span className="ff-num tnum">
          {String(field.position + 1).padStart(2, "0")}
        </span>
        <h3 className="ff-label m-0">
          {field.label}
          {field.required ? (
            <span className="ff-req" title="Required">
              *
            </span>
          ) : null}
        </h3>
        <StatusChip status={busy ? "drafted" : field.status} />
      </header>
      <div
        className="ff-help"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span className="ff-kind">{field.kind}</span>
        {limit ? <span className="ff-meta">{limit}</span> : null}
        {field.help ? <span>{field.help}</span> : null}
      </div>

      {needs && field.needsReason ? (
        <div className="ff-reason" role="note">
          <IconAlertTriangle size={14} />
          <span>
            <b>Needs you.</b> {field.needsReason}
          </span>
        </div>
      ) : null}

      <div className="ff-answer-wrap">
        {busy ? (
          <div className="ff-shimmer" aria-label="Drafting" />
        ) : isSelect ? (
          <select
            className="ff-input"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              commit(e.target.value);
            }}
          >
            <option value="">Choose…</option>
            {field.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <textarea
            ref={ref}
            rows={field.kind === "long" ? 4 : 1}
            className={`ff-answer${live.over ? " is-over" : ""}`}
            value={value}
            placeholder={
              needs
                ? "Only you can answer this. Type it here, or leave it for the form."
                : "Empty. Draft it from your bank, or type your own."
            }
            onFocus={() => {
              setFocused(true);
              onSelect();
            }}
            onBlur={() => {
              setFocused(false);
              commit(value);
            }}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                e.currentTarget.blur();
            }}
          />
        )}
      </div>

      <footer className="ff-field-foot">
        {field.charLimit || field.wordLimit ? (
          <div className={`ff-meter ${live.tone} tnum`} aria-live="polite">
            <div className="ff-meter-bar">
              <i
                style={{ width: `${Math.min(100, (live.ratio ?? 0) * 100)}%` }}
              />
            </div>
            {field.charLimit
              ? `${live.chars} / ${field.charLimit}`
              : `${live.words} / ${field.wordLimit} words`}
          </div>
        ) : value.trim() ? (
          <div className="ff-meter tnum">{live.chars} chars</div>
        ) : null}

        {field.provenance.map((p) => (
          <button
            key={`${p.entryId}:${p.factKey ?? ""}`}
            type="button"
            className="ff-prov"
            title="Show this in your bank"
            onClick={(e) => {
              e.stopPropagation();
              onProvenanceClick(p.entryId);
            }}
          >
            <IconDatabase size={11} stroke={2.2} />
            {p.topic}
            {p.factKey ? ` · ${p.factKey}` : ""}
          </button>
        ))}

        <div className="ff-actions">
          {!field.sensitiveCategory ? (
            <button
              type="button"
              className="ff-btn ff-btn-ghost ff-btn-sm"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                redraft();
              }}
              title="Draft again from your bank"
            >
              {refitting ? (
                <IconLoader2 size={13} className="ff-spin" />
              ) : (
                <IconSparkles size={13} />
              )}
              {field.answer.trim() ? "Redraft" : "Draft"}
            </button>
          ) : null}
          <button
            type="button"
            className="ff-btn ff-btn-ghost ff-btn-sm"
            disabled={!value.trim()}
            onClick={(e) => {
              e.stopPropagation();
              void copy();
            }}
            title="Copy answer"
          >
            <IconCopy size={13} /> Copy
          </button>
          <button
            type="button"
            className="ff-btn ff-btn-ghost ff-btn-sm"
            disabled={!field.answer.trim()}
            onClick={(e) => {
              e.stopPropagation();
              update.mutate(
                {
                  fieldId: field.id,
                  status: field.status === "ready" ? "unready" : "ready",
                },
                { onError: (err) => toast.error(err.message) },
              );
            }}
            title={
              field.status === "ready" ? "Mark as not ready" : "Mark ready"
            }
          >
            <IconCheck size={13} />{" "}
            {field.status === "ready" ? "Unready" : "Ready"}
          </button>
        </div>
      </footer>
    </article>
  );
}
