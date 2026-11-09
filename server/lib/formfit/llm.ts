import { completeText } from "@agent-native/core/server";

export const FORMFIT_MODEL = "claude-sonnet-5-5";

// Backstop for fan-out (fill-form = one call per field). The per-request
// guard in server/middleware/llm-guard.ts is the user-facing limit.
const HARD_DAILY_MODEL_CALLS = 2000;
let day = "";
let calls = 0;

export class LlmBudgetError extends Error {}

function countModelCall() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    calls = 0;
  }
  if (calls >= HARD_DAILY_MODEL_CALLS) {
    throw new LlmBudgetError(
      "The demo's daily AI budget is used up. Try again after midnight UTC. Editing and export still work.",
    );
  }
  calls += 1;
}

/** One model call; returns raw text. */
export async function ask(
  system: string,
  input: string,
  maxOutputTokens = 900,
) {
  countModelCall();
  const result = await completeText({
    systemPrompt: system,
    input,
    model: FORMFIT_MODEL,
    maxOutputTokens,
    temperature: 0.3,
    timeoutMs: 60_000,
  });
  return result.text;
}

/**
 * Models sometimes put raw newlines/tabs inside a JSON string (paragraph breaks
 * in a long answer), which JSON.parse rejects. Escape them inside strings only.
 */
export function escapeControlCharsInStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
      } else if (ch === "\\") {
        escaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "";
      else if (ch === "\t") out += "\\t";
      else out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

/** Pull the first JSON object out of a model reply, tolerating code fences and raw newlines in strings. */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const body = text.slice(start, end + 1);
  for (const candidate of [body, escapeControlCharsInStrings(body)]) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
