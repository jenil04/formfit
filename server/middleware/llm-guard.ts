import { defineEventHandler, getRequestIP } from "h3";

import { checkAndCountLlmRequest } from "../lib/formfit/rate-limit.js";

// LLM-backed entry points: the drafting/learning actions and the agent chat.
const GUARDED = [
  /^\/_agent-native\/actions\/(fill-field|fill-form|learn-from-edit|check-claims|fix-claim)$/,
  /^\/_agent-native\/agent-chat$/,
];

export default defineEventHandler((event) => {
  if (event.req.method !== "POST") return;
  const pathname = new URL(event.req.url).pathname;
  if (!GUARDED.some((re) => re.test(pathname))) return;
  const ip =
    event.req.headers.get("cf-connecting-ip") ??
    getRequestIP(event, { xForwardedFor: true }) ??
    "unknown";
  const quota = checkAndCountLlmRequest(ip);
  if (quota.ok) return;
  return new Response(
    JSON.stringify({ error: quota.message, errorCode: "demo_rate_limited" }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(quota.retryAfterSec),
      },
    },
  );
});
