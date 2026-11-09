import { useActionMutation } from "@agent-native/core/client/hooks";
import * as Dialog from "@radix-ui/react-dialog";
import { classifyField } from "@shared/classifier";
import { parseFormText } from "@shared/parser";
import { SAMPLE_FORMS } from "@shared/samples";
import {
  IconClipboardText,
  IconFileImport,
  IconLoader2,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function NewFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (formId: string) => void;
}) {
  const [text, setText] = useState("");
  const importForm = useActionMutation("import-form");
  const loadSample = useActionMutation("load-sample");

  // Same pure parser the server runs, so the preview is exactly what you'll get.
  const preview = useMemo(() => {
    if (text.trim().length < 10) return null;
    const p = parseFormText(text);
    const needs = p.fields.filter((f) => classifyField(f).sensitive).length;
    return { title: p.title, fields: p.fields.length, needs };
  }, [text]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ff-overlay" />
        <Dialog.Content className="ff ff-modal" aria-describedby="ff-new-desc">
          <Dialog.Title asChild>
            <h2>Paste a form</h2>
          </Dialog.Title>
          <p id="ff-new-desc" className="ff-sub" style={{ marginTop: 4 }}>
            Copy the text from any application page: labels, “(max 500
            characters)”, “Required”, dropdown options. Messy is fine.
          </p>
          <textarea
            className="ff-textarea ff-mono"
            style={{ marginTop: 14, minHeight: 230 }}
            placeholder={
              "Company name *\nDescribe your product (max 300 characters)\nWhy now?\n…"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
            }}
          >
            <button
              className="ff-btn ff-btn-primary"
              disabled={
                !preview || preview.fields === 0 || importForm.isPending
              }
              onClick={() =>
                importForm.mutate(
                  { text },
                  {
                    onSuccess: (r) => {
                      setText("");
                      onOpenChange(false);
                      onCreated(r.form.id);
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {importForm.isPending ? (
                <IconLoader2 size={14} className="ff-spin" />
              ) : (
                <IconFileImport size={14} />
              )}
              Import form
            </button>
            <span className="ff-meta tnum" aria-live="polite">
              {preview
                ? preview.fields === 0
                  ? "No fields found yet"
                  : `${preview.title.slice(0, 40)} · ${preview.fields} fields · ${preview.needs} only you can answer`
                : "Parsed live as you paste"}
            </span>
          </div>
          <div className="ff-section-label" style={{ margin: "22px 0 8px" }}>
            or start from a sample
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {SAMPLE_FORMS.map((s) => (
              <button
                key={s.id}
                className="ff-sample"
                disabled={loadSample.isPending}
                onClick={() =>
                  loadSample.mutate(
                    {
                      sampleId: s.id as
                        | "lumen-accelerator"
                        | "northwind-builders",
                    },
                    {
                      onSuccess: (r) => {
                        onOpenChange(false);
                        onCreated(r.form.id);
                      },
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                <IconClipboardText
                  size={18}
                  style={{ color: "hsl(var(--ff-accent))", flex: "none" }}
                />
                <div>
                  <b>{s.name}</b>
                  <span>{s.blurb}</span>
                </div>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
