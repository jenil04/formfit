import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconCheck,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { BankEntryDTO } from "../../../server/lib/formfit/store";

interface Props {
  entries: BankEntryDTO[];
  loading: boolean;
  /** entryId -> factKeys used by the selected field */
  used: Map<string, Set<string>>;
  flashId: string | null;
  onReset: () => void;
  resetting: boolean;
}

export function BankPane({
  entries,
  loading,
  used,
  flashId,
  onReset,
  resetting,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <aside className="ff-bank" aria-label="Answer bank">
      <div className="ff-bank-head">
        <div className="ff-wordmark">
          <span className="ff-logo">
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 4h12M2 8h8M2 12h5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Formfit
        </div>
        <span style={{ flex: 1 }} />
        <span className="ff-section-label tnum">
          Answer bank · {entries.length}
        </span>
        <button
          className="ff-btn ff-icon-btn"
          title="New bank entry"
          aria-label="New bank entry"
          onClick={() => setAdding((v) => !v)}
        >
          <IconPlus size={14} />
        </button>
      </div>
      <div className="ff-bank-scroll">
        {adding ? <EntryEditor onDone={() => setAdding(false)} /> : null}
        {loading && entries.length === 0 ? (
          <>
            <div className="ff-shimmer" style={{ height: 92 }} />
            <div className="ff-shimmer" style={{ height: 92 }} />
          </>
        ) : null}
        {!loading && entries.length === 0 && !adding ? (
          <div
            className="ff-entry"
            style={{ borderStyle: "dashed", textAlign: "center", padding: 20 }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Your bank is empty
            </div>
            <div
              style={{
                fontSize: 12,
                color: "hsl(var(--ff-muted))",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Add the answers you give again and again: one-liner, traction,
              team. Formfit drafts only from here.
            </div>
          </div>
        ) : null}
        {entries.map((e, i) => (
          <Entry
            key={e.id}
            entry={e}
            usedKeys={used.get(e.id)}
            flash={flashId === e.id}
            index={i}
          />
        ))}
      </div>
      <div className="ff-bank-foot">
        <span>Drafts use only what's here.</span>
        {confirmReset ? (
          <span style={{ display: "flex", gap: 4 }}>
            <button
              className="ff-btn ff-btn-sm"
              disabled={resetting}
              onClick={() => {
                setConfirmReset(false);
                onReset();
              }}
            >
              Confirm reset
            </button>
            <button
              className="ff-btn ff-btn-ghost ff-btn-sm"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            className="ff-btn ff-btn-ghost ff-btn-sm"
            onClick={() => setConfirmReset(true)}
            title="Restore the demo bank and sample form"
          >
            Reset demo
          </button>
        )}
      </div>
    </aside>
  );
}

function Entry({
  entry,
  usedKeys,
  flash,
  index,
}: {
  entry: BankEntryDTO;
  usedKeys: Set<string> | undefined;
  flash: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isUsed = !!usedKeys;

  useEffect(() => {
    if (isUsed) setOpen(true);
  }, [isUsed]);

  if (editing)
    return <EntryEditor entry={entry} onDone={() => setEditing(false)} />;
  const cls = `ff-entry ff-rise${isUsed ? " is-used" : ""}${flash ? " is-flash" : ""}`;
  return (
    <div
      id={`bank-${entry.id}`}
      ref={ref}
      className={cls}
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
      key={flash ? `${entry.id}-${entry.updatedAt}` : entry.id}
    >
      <div className="ff-entry-topic">
        <span style={{ flex: 1 }}>{entry.topic}</span>
        <button
          className="ff-btn ff-btn-ghost ff-icon-btn"
          aria-label={`Edit ${entry.topic}`}
          onClick={() => setEditing(true)}
        >
          <IconPencil size={13} />
        </button>
        <button
          className="ff-btn ff-btn-ghost ff-icon-btn"
          aria-label={open ? "Collapse" : "Expand"}
          onClick={() => setOpen((v) => !v)}
        >
          <IconChevronDown
            size={14}
            style={{
              transform: open ? "rotate(180deg)" : undefined,
              transition: "transform .15s",
            }}
          />
        </button>
      </div>
      <div className={`ff-entry-body${open ? "" : " ff-clamp"}`}>
        {entry.answer}
      </div>
      {entry.facts.length > 0 && (open || isUsed) ? (
        <dl className="ff-facts">
          {entry.facts.map((f) => (
            <div
              key={f.key}
              className={`ff-fact${usedKeys?.has(f.key) ? " is-used" : ""}`}
              title={f.source ? `Source: ${f.source}` : undefined}
            >
              <dt>{f.key}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : entry.facts.length > 0 ? (
        <div className="ff-meta" style={{ marginTop: 7 }}>
          {entry.facts.length} fact{entry.facts.length > 1 ? "s" : ""}
        </div>
      ) : null}
    </div>
  );
}

function EntryEditor({
  entry,
  onDone,
}: {
  entry?: BankEntryDTO;
  onDone: () => void;
}) {
  const [topic, setTopic] = useState(entry?.topic ?? "");
  const [answer, setAnswer] = useState(entry?.answer ?? "");
  const [facts, setFacts] = useState(entry?.facts ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useActionMutation("upsert-bank-entry");
  const del = useActionMutation("delete-bank-entry");

  return (
    <div
      className="ff-entry"
      style={{ borderColor: "hsl(var(--ff-accent) / .6)" }}
    >
      <input
        className="ff-input"
        placeholder="Topic (e.g. traction)"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        autoFocus={!entry}
      />
      <textarea
        className="ff-textarea"
        style={{ marginTop: 6 }}
        rows={6}
        placeholder="Canonical long answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="ff-section-label" style={{ margin: "10px 0 4px" }}>
        Hard facts
      </div>
      {facts.map((f, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr 24px",
            gap: 4,
            marginBottom: 4,
          }}
        >
          <input
            className="ff-input"
            placeholder="key"
            value={f.key}
            onChange={(e) =>
              setFacts(
                facts.map((x, j) =>
                  j === i ? { ...x, key: e.target.value } : x,
                ),
              )
            }
          />
          <input
            className="ff-input"
            placeholder="value"
            value={f.value}
            onChange={(e) =>
              setFacts(
                facts.map((x, j) =>
                  j === i ? { ...x, value: e.target.value } : x,
                ),
              )
            }
          />
          <button
            className="ff-btn ff-btn-ghost ff-icon-btn"
            aria-label="Remove fact"
            onClick={() => setFacts(facts.filter((_, j) => j !== i))}
          >
            <IconX size={12} />
          </button>
        </div>
      ))}
      <button
        className="ff-btn ff-btn-ghost ff-btn-sm"
        onClick={() => setFacts([...facts, { key: "", value: "" }])}
      >
        <IconPlus size={12} /> Add fact
      </button>
      <div
        style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}
      >
        <button
          className="ff-btn ff-btn-primary ff-btn-sm"
          disabled={!topic.trim() || !answer.trim() || save.isPending}
          onClick={() =>
            save.mutate(
              { ...(entry ? { id: entry.id } : {}), topic, answer, facts },
              { onSuccess: onDone, onError: (e) => toast.error(e.message) },
            )
          }
        >
          <IconCheck size={13} /> Save
        </button>
        <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={onDone}>
          Cancel
        </button>
        <span style={{ flex: 1 }} />
        {entry ? (
          confirmDelete ? (
            <button
              className="ff-btn ff-btn-sm"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(
                  { id: entry.id },
                  { onSuccess: onDone, onError: (e) => toast.error(e.message) },
                )
              }
            >
              Delete for good?
            </button>
          ) : (
            <button
              className="ff-btn ff-btn-ghost ff-icon-btn"
              aria-label="Delete entry"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash size={13} />
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
