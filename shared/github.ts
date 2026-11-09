import type { EvidenceKind } from "./types.js";

export const MAX_COMMITS = 100;

export interface RepoRef {
  owner: string;
  repo: string;
  slug: string;
}

/** Accepts https://github.com/owner/repo(.git)(/anything), github.com/owner/repo or owner/repo. */
export function parseRepoRef(input: string): RepoRef | null {
  const s = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  const m =
    /^github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})(?:[/?#].*)?$/.exec(
      s,
    ) ??
    /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(s);
  if (!m) return null;
  const repo = m[2]!.replace(/\.git$/i, "");
  if (!repo || repo === "." || repo === "..") return null;
  return { owner: m[1]!, repo, slug: `${m[1]}/${repo}` };
}

export interface EvidenceDraft {
  id: string;
  repo: string;
  kind: EvidenceKind;
  title: string;
  date: string;
  url: string;
  sha: string | null;
}

const clip = (s: string, n = 200) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
const firstLine = (s: string) => (s ?? "").split("\n")[0]!.trim();

export function mapCommit(slug: string, c: any): EvidenceDraft | null {
  const title = firstLine(c?.commit?.message ?? "");
  if (!c?.sha || !title) return null;
  if (/^Merge (pull request|branch|remote-tracking)/i.test(title)) return null;
  return {
    id: `commit:${slug}:${c.sha}`,
    repo: slug,
    kind: "commit",
    title: clip(title),
    date: c.commit?.author?.date ?? c.commit?.committer?.date ?? "",
    url: c.html_url ?? `https://github.com/${slug}/commit/${c.sha}`,
    sha: String(c.sha).slice(0, 7),
  };
}

export function mapPull(slug: string, p: any): EvidenceDraft | null {
  if (!p?.merged_at || !p?.number) return null; // closed-unmerged PRs are not shipped work
  return {
    id: `pr:${slug}:${p.number}`,
    repo: slug,
    kind: "pr",
    title: clip(String(p.title ?? "").trim()),
    date: p.merged_at,
    url: p.html_url ?? `https://github.com/${slug}/pull/${p.number}`,
    sha: `#${p.number}`,
  };
}

export function mapRelease(slug: string, r: any): EvidenceDraft | null {
  if (!r?.tag_name || r.draft) return null;
  const name = String(r.name ?? "").trim();
  const title =
    name && name !== r.tag_name ? `${r.tag_name} ${name}` : r.tag_name;
  return {
    id: `release:${slug}:${r.tag_name}`,
    repo: slug,
    kind: "release",
    title: clip(title),
    date: r.published_at ?? r.created_at ?? "",
    url: r.html_url ?? `https://github.com/${slug}/releases/tag/${r.tag_name}`,
    sha: null,
  };
}

export interface RateLimitInfo {
  limited: boolean;
  resetAt: string | null;
  message: string;
}

/** GitHub signals rate limiting with 403/429 and x-ratelimit-remaining: 0 (or retry-after). */
export function readRateLimit(
  status: number,
  headers: { get(n: string): string | null },
  hasToken: boolean,
): RateLimitInfo {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const retryAfter = headers.get("retry-after");
  const limited =
    status === 429 || (status === 403 && (remaining === "0" || !!retryAfter));
  const resetAt = reset
    ? new Date(Number(reset) * 1000).toISOString()
    : retryAfter
      ? new Date(Date.now() + Number(retryAfter) * 1000).toISOString()
      : null;
  const when = resetAt ? ` Resets at ${resetAt.slice(11, 16)} UTC.` : "";
  return {
    limited,
    resetAt,
    message: `GitHub's rate limit was hit.${when}${hasToken ? "" : " Set GITHUB_TOKEN to raise the limit."}`,
  };
}
