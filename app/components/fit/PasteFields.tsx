import { useActionMutation } from "@agent-native/core/client/hooks";
import { classifyField } from "@shared/classifier";
import { parseFormText } from "@shared/parser";
import { IconLoader2 } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** A form started from a program has no fields yet: paste the application page's text here. */
export function PasteFields({ formId }: { formId: string }) {
  const [text, setText] = useState("");
  const add = useActionMutation("import-form");
  const preview = useMemo(() => {
    if (text.trim().length < 10) return null;
    const p = parseFormText(text);
    return {
      fields: p.fields.length,
      needs: p.fields.filter((f) => classifyField(f).sensitive).length,
    };
  }, [text]);
  return (
    <div className="ff-field" style={{ marginTop: 18 }}>
      <h3 className="ff-label m-0">Paste the form's fields</h3>
      <p className="ff-help" style={{ margin: "4px 0 10px" }}>
        Open the program's application page and copy its questions: labels,
        limits like “(max 500 characters)”, “Required”. Messy is fine.
      </p>
      <textarea
        className="ff-textarea ff-mono"
        style={{ minHeight: 170 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "Company name *\nDescribe your product (max 300 characters)\n…"
        }
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 10,
        }}
      >
        <span className="ff-meta tnum" style={{ flex: 1 }}>
          {preview
            ? `${preview.fields} fields found${preview.needs ? `, ${preview.needs} need you` : ""}`
            : "Waiting for text…"}
        </span>
        <button
          className="ff-btn ff-btn-primary"
          disabled={!preview || preview.fields === 0 || add.isPending}
          onClick={() =>
            add.mutate(
              { text, formId },
              { onError: (e) => toast.error(e.message) },
            )
          }
        >
          {add.isPending ? <IconLoader2 size={14} className="ff-spin" /> : null}
          Add fields
        </button>
      </div>
    </div>
  );
}
