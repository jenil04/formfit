import { useActionQuery } from "@agent-native/core/client/hooks";
import * as Dialog from "@radix-ui/react-dialog";
import { IconCopy, IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";

import { StatusChip } from "./FieldCard";

export function ExportSheet({
  formId,
  open,
  onOpenChange,
}: {
  formId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const q = useActionQuery("export-packet", { formId }, { enabled: open });
  const packet = q.data;
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}`, { duration: 1400 });
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ff-overlay" />
        <Dialog.Content
          className="ff ff-modal"
          aria-describedby="ff-exp-desc"
          style={{ width: "min(820px, 94vw)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dialog.Title asChild>
              <h2 style={{ flex: 1 }}>Copy packet</h2>
            </Dialog.Title>
            <button
              className="ff-btn"
              disabled={!packet}
              onClick={() => packet && copy(packet.text, "the whole packet")}
            >
              <IconCopy size={14} /> Copy all
            </button>
            <button
              className="ff-btn"
              disabled={!packet}
              onClick={() => {
                if (!packet) return;
                const url = URL.createObjectURL(
                  new Blob([packet.text], { type: "text/plain" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `${packet.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <IconDownload size={14} /> .txt
            </button>
          </div>
          <p id="ff-exp-desc" className="ff-sub" style={{ marginTop: 4 }}>
            {packet
              ? packet.needsYou > 0
                ? `${packet.needsYou} field${packet.needsYou > 1 ? "s" : ""} still need you. They're marked in the packet.`
                : "Every field has an answer."
              : "Building packet…"}
          </p>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {packet?.rows.map((r) => (
              <div
                key={r.n}
                className="ff-entry"
                style={{ padding: "10px 12px" }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="ff-num tnum" style={{ width: "auto" }}>
                    {String(r.n).padStart(2, "0")}
                  </span>
                  <b style={{ fontSize: 13, flex: 1 }}>{r.label}</b>
                  <span
                    className="ff-meta tnum"
                    style={
                      r.overLimit ? { color: "hsl(var(--ff-red))" } : undefined
                    }
                  >
                    {r.charLimit
                      ? `${r.chars}/${r.charLimit}`
                      : r.wordLimit
                        ? `${r.words}/${r.wordLimit} words`
                        : r.chars
                          ? `${r.chars} chars`
                          : ""}
                  </span>
                  <StatusChip status={r.status} />
                  <button
                    className="ff-btn ff-btn-ghost ff-btn-sm"
                    disabled={!r.answer.trim()}
                    onClick={() => copy(r.answer, `#${r.n}`)}
                  >
                    <IconCopy size={12} /> Copy
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    marginTop: 5,
                    lineHeight: 1.5,
                    color: r.answer.trim()
                      ? "hsl(var(--ff-ink-2))"
                      : "hsl(var(--ff-amber))",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {r.answer.trim() ||
                    `Needs you${r.reason ? `: ${r.reason}` : ""}`}
                </div>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
