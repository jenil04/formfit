/**
 * Public-demo cost guard. In-memory by design: it protects the shared API key
 * on a single persistent box, and resets on restart.
 *  - 60 LLM-backed requests per hour per IP
 *  - 400 LLM-backed requests per day overall
 * A separate hard ceiling on raw model calls (see llm.ts) backstops fan-out
 * from `fill-form`, which makes one model call per field.
 */
export const PER_IP_HOURLY = 60;
export const GLOBAL_DAILY = 400;

const HOUR = 60 * 60 * 1000;
const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export type Quota =
  | { ok: true }
  | { ok: false; message: string; retryAfterSec: number };

export function checkAndCountLlmRequest(ip: string, now = Date.now()): Quota {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= GLOBAL_DAILY) {
    const tomorrow = Date.parse(`${today}T00:00:00Z`) + 24 * HOUR;
    return {
      ok: false,
      retryAfterSec: Math.ceil((tomorrow - now) / 1000),
      message: `The Formfit demo has used its daily AI budget (${GLOBAL_DAILY} requests). Everything else still works. AI drafting resets at midnight UTC.`,
    };
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= PER_IP_HOURLY) {
    const retryAfterSec = Math.ceil(((recent[0] ?? now) + HOUR - now) / 1000);
    return {
      ok: false,
      retryAfterSec,
      message: `You've hit the demo limit of ${PER_IP_HOURLY} AI requests per hour. Try again in about ${Math.ceil(retryAfterSec / 60)} minutes. Editing, importing and exporting still work.`,
    };
  }
  recent.push(now);
  hits.set(ip, recent);
  dayCount += 1;
  return { ok: true };
}

export function resetRateLimitsForTests(): void {
  hits.clear();
  day = "";
  dayCount = 0;
}
