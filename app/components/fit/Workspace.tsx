import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconChevronDown,
  IconFileExport,
  IconLoader2,
  IconPlus,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { BankPane } from "./BankPane";
import { EmptyState } from "./EmptyState";
import { ExportSheet } from "./ExportSheet";
import { FieldCard } from "./FieldCard";
import { NewFormDialog } from "./NewFormDialog";
import { ProposalCard } from "./ProposalCard";

import "./fit.css";

const FORM_STATUSES = ["draft", "ready", "submitted"] as const;

export default function Workspace() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const fieldId = sp.get("field");

  const formsQ = useActionQuery("list-forms");
  const bankQ = useActionQuery("list-bank");
  const forms = formsQ.data?.forms ?? [];
  const fillAll = useActionMutation("fill-form");
  const setStatus = useActionMutation("set-form-status");
  const reset = useActionMutation("reset-demo");
  const deleteForm = useActionMutation("delete-form");

  const activeId =
    formId && (forms.length === 0 || forms.some((f) => f.id === formId))
      ? formId
      : forms[0]?.id;
  const formQ = useActionQuery(
    "get-form",
    { id: activeId ?? "" },
    { enabled: !!activeId, refetchInterval: fillAll.isPending ? 900 : false },
  );
  const form = formQ.data?.form;

  // Keep the URL (and so the agent's context) pointing at a real form.
  useEffect(() => {
    if (!formsQ.isSuccess) return;
    if (activeId && formId !== activeId)
      navigate(`/fit/${activeId}`, { replace: true });
    if (!activeId && formId) navigate("/fit", { replace: true });
  }, [formsQ.isSuccess, activeId, formId, navigate]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const selected = form?.fields.find((f) => f.id === fieldId);
  useEffect(() => {
    if (!fieldId) return;
    document
      .getElementById(`field-${fieldId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [fieldId, form?.id]);

  // Which bank entries / facts the selected field used.
  const used = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const p of selected?.provenance ?? []) {
      const s = m.get(p.entryId) ?? new Set<string>();
      if (p.factKey) s.add(p.factKey);
      m.set(p.entryId, s);
    }
    return m;
  }, [selected]);

  const select = (id: string) => {
    if (id === fieldId) return;
    const next = new URLSearchParams(sp);
    next.set("field", id);
    setSp(next, { replace: true, preventScrollReset: true });
  };

  const flash = (entryId: string) => {
    document
      .getElementById(`bank-${entryId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(entryId);
    setTimeout(() => setFlashId(null), 2600);
  };

  const eligible =
    form?.fields.filter((f) => !f.sensitiveCategory && f.status === "empty") ??
    [];

  const runFillAll = () => {
    if (!form) return;
    setPendingIds(new Set(eligible.map((f) => f.id)));
    fillAll.mutate(
      { formId: form.id },
      {
        onSuccess: (r) =>
          toast.success(
            `Drafted ${r.drafted} field${r.drafted === 1 ? "" : "s"}. ${r.needsYou} need${r.needsYou === 1 ? "s" : ""} you.`,
          ),
        onError: (e) => toast.error(e.message),
        onSettled: () => setPendingIds(new Set()),
      },
    );
  };

  const goTo = (id: string) => navigate(`/fit/${id}`);

  const loadingFirst =
    formsQ.isLoading || (activeId && formQ.isLoading && !form);
  const counts = form
    ? {
        drafted: form.fields.filter((f) => f.status === "drafted").length,
        edited: form.fields.filter((f) => f.status === "edited").length,
        ready: form.fields.filter((f) => f.status === "ready").length,
        needs: form.needsYou,
        empty: form.fields.filter((f) => f.status === "empty").length,
      }
    : null;
  const total = form?.total || 1;

  return (
    <div className="ff flex h-full min-h-0 w-full">
      <BankPane
        entries={bankQ.data?.entries ?? []}
        loading={bankQ.isLoading}
        used={used}
        flashId={flashId}
        resetting={reset.isPending}
        onReset={() =>
          reset.mutate(
            {},
            {
              onSuccess: (r) => {
                toast.success("Demo reset");
                navigate(`/fit/${r.form.id}`);
              },
              onError: (e) => toast.error(e.message),
            },
          )
        }
      />

      <section className="ff-center" aria-label="Form">
        <div className="ff-topbar">
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              className="ff-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              disabled={forms.length === 0}
            >
              <span
                style={{
                  maxWidth: 190,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {form?.title ?? "No form yet"}
              </span>
              <IconChevronDown size={14} />
            </button>
            {menuOpen ? (
              <div className="ff-menu" role="listbox">
                {forms.map((f) => (
                  <button
                    key={f.id}
                    role="option"
                    aria-selected={f.id === activeId}
                    onClick={() => {
                      setMenuOpen(false);
                      goTo(f.id);
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <b
                        style={{
                          display: "block",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 210,
                        }}
                      >
                        {f.title}
                      </b>
                      <span className="ff-meta tnum">
                        {f.total} fields · {f.needsYou} need you · {f.status}
                      </span>
                    </span>
                    <span
                      role="button"
                      aria-label={`Delete ${f.title}`}
                      className="ff-btn ff-btn-ghost ff-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteForm.mutate(
                          { formId: f.id },
                          { onError: (err) => toast.error(err.message) },
                        );
                      }}
                    >
                      <IconTrash size={13} />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            className="ff-btn ff-btn-ghost"
            onClick={() => setNewOpen(true)}
          >
            <IconPlus size={14} /> New form
          </button>
          <span style={{ flex: 1 }} />
          {form ? (
            <>
              <button className="ff-btn" onClick={() => setExportOpen(true)}>
                <IconFileExport size={14} /> Copy packet
              </button>
              <button
                className="ff-btn ff-btn-primary"
                onClick={runFillAll}
                disabled={fillAll.isPending || eligible.length === 0}
              >
                {fillAll.isPending ? (
                  <IconLoader2 size={14} className="ff-spin" />
                ) : (
                  <IconSparkles size={14} />
                )}
                {fillAll.isPending
                  ? "Drafting…"
                  : eligible.length === 0
                    ? "All safe fields filled"
                    : `Fill ${eligible.length} safe field${eligible.length === 1 ? "" : "s"}`}
              </button>
            </>
          ) : null}
        </div>

        <div className="ff-scroll">
          {loadingFirst ? (
            <div className="ff-doc">
              <div
                className="ff-shimmer"
                style={{ height: 34, width: "60%" }}
              />
              <div
                className="ff-shimmer"
                style={{ height: 120, marginTop: 24 }}
              />
              <div
                className="ff-shimmer"
                style={{ height: 120, marginTop: 12 }}
              />
            </div>
          ) : !form ? (
            <EmptyState onCreated={goTo} onPaste={() => setNewOpen(true)} />
          ) : (
            <div className="ff-doc">
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: 16 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 className="ff-title">{form.title}</h1>
                  {form.description ? (
                    <p className="ff-sub">{form.description}</p>
                  ) : null}
                </div>
                <div className="ff-seg" role="group" aria-label="Form status">
                  {FORM_STATUSES.map((s) => (
                    <button
                      key={s}
                      aria-pressed={form.status === s}
                      onClick={() =>
                        form.status !== s &&
                        setStatus.mutate(
                          { formId: form.id, status: s },
                          {
                            onError: (e) =>
                              toast.error(e.message, { duration: 7000 }),
                          },
                        )
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {counts ? (
                <div style={{ margin: "18px 0 22px" }}>
                  <div className="ff-progress" aria-hidden>
                    <i
                      style={{
                        width: `${(counts.ready / total) * 100}%`,
                        background: "hsl(var(--ff-green))",
                      }}
                    />
                    <i
                      style={{
                        width: `${((counts.drafted + counts.edited) / total) * 100}%`,
                        background: "hsl(var(--ff-accent))",
                      }}
                    />
                    <i
                      style={{
                        width: `${(counts.needs / total) * 100}%`,
                        background: "hsl(var(--ff-amber))",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      marginTop: 9,
                      flexWrap: "wrap",
                    }}
                    className="ff-meta tnum"
                  >
                    <span>
                      <b style={{ color: "hsl(var(--ff-accent))" }}>
                        {counts.drafted + counts.edited}
                      </b>{" "}
                      drafted or edited
                    </span>
                    <span>
                      <b style={{ color: "hsl(var(--ff-green))" }}>
                        {counts.ready}
                      </b>{" "}
                      ready
                    </span>
                    <span>
                      <b style={{ color: "hsl(var(--ff-amber))" }}>
                        {counts.needs}
                      </b>{" "}
                      need you
                    </span>
                    {counts.empty > 0 ? (
                      <span>{counts.empty} empty</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {form.fields.map((f) => (
                <div key={f.id}>
                  <FieldCard
                    field={f}
                    selected={f.id === fieldId}
                    pending={pendingIds.has(f.id) && f.status !== "drafted"}
                    onSelect={() => select(f.id)}
                    onProvenanceClick={flash}
                  />
                  {form.proposals
                    .filter((p) => p.fieldId === f.id)
                    .map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        onApplied={(id) => id && flash(id)}
                      />
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {fillAll.isPending ? (
        <div className="ff-toast-fill" role="status">
          <IconLoader2 size={14} className="ff-spin" />
          Drafting from your bank, fitting each limit…
        </div>
      ) : null}

      <NewFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={goTo}
      />
      {form ? (
        <ExportSheet
          formId={form.id}
          open={exportOpen}
          onOpenChange={setExportOpen}
        />
      ) : null}
    </div>
  );
}
