import { fail } from "@agent-native/core/action";

import {
  MAX_COMMITS,
  mapCommit,
  mapPull,
  mapRelease,
  readRateLimit,
  type EvidenceDraft,
  type RepoRef,
} from "../../../shared/github.js";

const API = "https://api.github.com";

// Optional deploy-level token that only raises GitHub's rate limit on PUBLIC
// repos; it is not a user credential and is never logged or returned.
const githubToken = () => process.env.GITHUB_TOKEN; // guard:allow-env-credential — optional deploy-level token, specified by the product owner

async function gh(path: string, signal: AbortSignal) {
  const token = githubToken();
  return fetch(`${API}${path}`, {
    signal,
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "formfit-evidence-import",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

export interface GithubImport {
  items: EvidenceDraft[];
  counts: { commits: number; prs: number; releases: number };
  warnings: string[];
}

/**
 * Public repo only. Commits are mandatory (a failure there fails the import);
 * PRs and releases degrade to a warning so a rate limit mid-import keeps what we got.
 */
export async function fetchGithubEvidence(
  ref: RepoRef,
  maxCommits = MAX_COMMITS,
): Promise<GithubImport> {
  const hasToken = !!githubToken();
  const signal = AbortSignal.timeout(20_000);
  const base = `/repos/${ref.owner}/${ref.repo}`;
  const warnings: string[] = [];
  const perPage = Math.min(Math.max(1, maxCommits), MAX_COMMITS);

  const get = async (
    path: string,
    required: boolean,
  ): Promise<any[] | null> => {
    let res: Response;
    try {
      res = await gh(path, signal);
    } catch (e) {
      const msg = `Couldn't reach GitHub (${e instanceof Error ? e.message : "network error"}).`;
      if (required)
        fail(msg, { errorCode: "github_unreachable", statusCode: 502 });
      warnings.push(msg);
      return null;
    }
    if (res.ok) return (await res.json()) as any[];
    const rl = readRateLimit(res.status, res.headers, hasToken);
    if (rl.limited) {
      if (required)
        fail(rl.message, { errorCode: "github_rate_limited", statusCode: 429 });
      warnings.push(rl.message);
      return null;
    }
    if (res.status === 404 || res.status === 451)
      fail(`${ref.slug} wasn't found or isn't public.`, {
        errorCode: "github_not_found",
        statusCode: 404,
      });
    const msg = `GitHub returned ${res.status} for ${path.split("?")[0]}.`;
    if (required) fail(msg, { errorCode: "github_error", statusCode: 502 });
    warnings.push(msg);
    return null;
  };

  const commitRows = (await get(`${base}/commits?per_page=${perPage}`, true))!;
  const commits = commitRows
    .map((c) => mapCommit(ref.slug, c))
    .filter((e): e is EvidenceDraft => !!e);
  const prs = (
    (await get(
      `${base}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
      false,
    )) ?? []
  )
    .map((p) => mapPull(ref.slug, p))
    .filter((e): e is EvidenceDraft => !!e);
  const releases = ((await get(`${base}/releases?per_page=20`, false)) ?? [])
    .map((r) => mapRelease(ref.slug, r))
    .filter((e): e is EvidenceDraft => !!e);

  return {
    items: [...commits, ...prs, ...releases],
    counts: {
      commits: commits.length,
      prs: prs.length,
      releases: releases.length,
    },
    warnings,
  };
}
