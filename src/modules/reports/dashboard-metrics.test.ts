import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  businessDay,
  formatPKR,
  netIncome,
  pctChange,
} from "./dashboard-metrics";

describe("pctChange", () => {
  it("returns null for two zero values and new for a zero baseline", () => {
    assert.equal(pctChange(0, 0), null);
    assert.equal(pctChange(12, 0), "new");
  });

  it("calculates changes against positive and negative baselines", () => {
    assert.equal(pctChange(150, 100), 50);
    assert.equal(pctChange(-5, -10), 50);
    assert.equal(pctChange(-15, -10), -50);
  });
});

describe("netIncome", () => {
  it("subtracts refunds and expenses from sales", () => {
    assert.equal(netIncome({ sales: 1000, refunds: 100, expenses: 250 }), 650);
  });

  it("treats omitted amounts as zero", () => {
    assert.equal(netIncome({ sales: 100 }), 100);
    assert.equal(netIncome({}), 0);
  });
});

describe("formatPKR", () => {
  it("formats rupees with en-PK grouping", () => {
    assert.equal(formatPKR(0), "Rs. 0");
    assert.equal(formatPKR(100_000), "Rs. 100,000");
    assert.equal(formatPKR(10_000_000), "Rs. 10,000,000");
  });
});

describe("businessDay", () => {
  it("returns the date in the requested timezone", () => {
    assert.equal(
      businessDay("2026-11-23T20:00:00Z", "Asia/Karachi"),
      "2026-11-24",
    );
    assert.equal(
      businessDay("2026-11-23T18:59:59Z", "Asia/Karachi"),
      "2026-11-23",
    );
  });
});
