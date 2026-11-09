/** Normalise and rank rows from GET https://earnkit.com/api/programs (read-only, never written to). */
export interface Program {
  id: string;
  title: string;
  organizer: string;
  category: string;
  money: string | null;
  status: string;
  closesAt: string | null;
  closesIn: string | null;
  submissionUrl: string | null;
  sourceUrl: string | null;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export function normalizePrograms(raw: unknown): Program[] {
  const rows = (raw as { programs?: unknown })?.programs;
  if (!Array.isArray(rows)) return [];
  const out: Program[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const id = str(r?.id);
    const title = str(r?.title);
    if (!id || !title) continue;
    out.push({
      id,
      title,
      organizer: str(r.organizer) ?? "",
      category: str(r.category) ?? "",
      money: str(r.money),
      status: str(r.status) ?? "",
      closesAt: str(r.closes_at),
      closesIn: str(r.closes_in),
      submissionUrl: str(r.submission_url),
      sourceUrl: str(r.source_url),
    });
  }
  return out;
}

/** Soonest deadline first; rolling (no deadline) last; already-closed dropped. */
export function rankByDeadline(
  programs: Program[],
  now = Date.now(),
): Program[] {
  const t = (p: Program) =>
    p.closesAt ? Date.parse(p.closesAt) : Number.POSITIVE_INFINITY;
  return programs
    .filter(
      (p) => p.status !== "closed" && !(Number.isFinite(t(p)) && t(p) < now),
    )
    .sort((a, b) => t(a) - t(b) || a.title.localeCompare(b.title));
}
