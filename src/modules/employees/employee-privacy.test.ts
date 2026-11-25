import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REDACTED,
  redactAuditSnapshot,
  salaryChanged,
  stripPii,
} from "./employee-privacy";

describe("redactAuditSnapshot", () => {
  it("masks CNIC and salary but keeps non-sensitive fields", () => {
    assert.deepEqual(
      redactAuditSnapshot({ fullName: "Ali", cnic: "35202-1234567-1", monthlySalaryPaisa: 3500000 }),
      { fullName: "Ali", cnic: REDACTED, monthlySalaryPaisa: REDACTED },
    );
  });

    it("returns an empty object for empty snapshots", () => {
    assert.deepEqual(redactAuditSnapshot(null), {});
  });
});

describe("stripPii", () => {
  const row = { fullName: "Ali", cnic: "x", emergencyPhone: "y", emergencyContact: "z" };

  it("removes PII for callers without access", () => {
    assert.deepEqual(stripPii(row, false), { fullName: "Ali" });
  });

  it("keeps PII for callers with access", () => {
    assert.deepEqual(stripPii(row, true), row);
  });
});

describe("salaryChanged", () => {
  it("is false when the salary is not provided or unchanged", () => {
    assert.equal(salaryChanged(100, undefined), false);
    assert.equal(salaryChanged(100, 100), false);
  });

  it("is true for a real change", () => {
    assert.equal(salaryChanged(100, 150), true);
  });
});
