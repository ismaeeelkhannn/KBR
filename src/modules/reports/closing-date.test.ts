import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closingDateDecision } from "./closing-date";

const TZ = "Asia/Karachi";

describe("closingDateDecision", () => {
  // 2026-11-25 10:00 in Karachi (UTC+5) = 05:00Z
  const now = new Date("2026-11-25T05:00:00Z");

  it("allows closing a past day", () => {
    assert.equal(closingDateDecision("2026-11-24", now, TZ).allowed, true);
  });

  it("blocks closing the current business day", () => {
    assert.equal(closingDateDecision("2026-11-25", now, TZ).allowed, false);
  });

  it("blocks closing a future day", () => {
    assert.equal(closingDateDecision("2026-11-26", now, TZ).allowed, false);
  });

  it("uses the restaurant timezone at the day boundary", () => {
    // 2026-11-25 20:00Z is already 2026-11-26 01:00 in Karachi.
    const lateUtc = new Date("2026-11-25T20:00:00Z");
    assert.equal(closingDateDecision("2026-11-25", lateUtc, TZ).allowed, true);
  });
});
