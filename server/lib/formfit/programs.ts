import { PROGRAMS_SNAPSHOT } from "../../../shared/programs-snapshot.js";
import {
  normalizePrograms,
  rankByDeadline,
  type Program,
} from "../../../shared/programs.js";

// The ONLY earnkit.com endpoint this app touches, read-only GET.
const PROGRAMS_URL = "https://earnkit.com/api/programs";
const TTL_MS = 60 * 60 * 1000;

let cache: { at: number; programs: Program[] } | null = null;

export interface ProgramsResult {
  programs: Program[];
  source: "live" | "cache" | "snapshot";
  fetchedAt: string;
  note: string | null;
}

export async function loadPrograms(force = false): Promise<ProgramsResult> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    return {
      programs: rankByDeadline(cache.programs),
      source: "cache",
      fetchedAt: new Date(cache.at).toISOString(),
      note: null,
    };
  }
  try {
    const res = await fetch(PROGRAMS_URL, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "formfit" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { ok?: boolean };
    const programs = normalizePrograms(json);
    if (json.ok === false || programs.length === 0)
      throw new Error("empty or not ok");
    cache = { at: Date.now(), programs };
    return {
      programs: rankByDeadline(programs),
      source: "live",
      fetchedAt: new Date(cache.at).toISOString(),
      note: null,
    };
  } catch (e) {
    console.warn(
      "[formfit] programs fetch failed, using snapshot:",
      e instanceof Error ? e.message : e,
    );
    return {
      programs: rankByDeadline(normalizePrograms(PROGRAMS_SNAPSHOT)),
      source: "snapshot",
      fetchedAt: PROGRAMS_SNAPSHOT.capturedAt,
      note: `Live list unavailable; showing a snapshot from ${PROGRAMS_SNAPSHOT.capturedAt}.`,
    };
  }
}

export async function getProgram(id: string): Promise<Program | null> {
  const { programs } = await loadPrograms();
  return programs.find((p) => p.id === id) ?? null;
}
