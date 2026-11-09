import { beforeEach, describe, expect, it } from "vitest";

import {
  checkAndCountLlmRequest,
  GLOBAL_DAILY,
  PER_IP_HOURLY,
  resetRateLimitsForTests,
} from "./rate-limit";

describe("llm rate limit", () => {
  beforeEach(resetRateLimitsForTests);
  const t0 = Date.parse("2026-11-10T10:00:00Z");

  it("allows 60/hour per IP then returns a friendly message", () => {
    for (let i = 0; i < PER_IP_HOURLY; i++) {
      expect(checkAndCountLlmRequest("1.1.1.1", t0 + i).ok).toBe(true);
    }
    const r = checkAndCountLlmRequest("1.1.1.1", t0 + 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/per hour/);
    expect(checkAndCountLlmRequest("2.2.2.2", t0 + 1000).ok).toBe(true);
  });

  it("frees the IP after an hour", () => {
    for (let i = 0; i < PER_IP_HOURLY; i++)
      checkAndCountLlmRequest("1.1.1.1", t0);
    expect(checkAndCountLlmRequest("1.1.1.1", t0 + 61 * 60 * 1000).ok).toBe(
      true,
    );
  });

  it("enforces the global daily cap", () => {
    for (let i = 0; i < GLOBAL_DAILY; i++) {
      expect(checkAndCountLlmRequest(`ip-${i}`, t0).ok).toBe(true);
    }
    const r = checkAndCountLlmRequest("fresh", t0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/daily/);
    expect(checkAndCountLlmRequest("fresh", t0 + 24 * 3600 * 1000).ok).toBe(
      true,
    );
  });
});
