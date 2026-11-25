/**
 * Employee personal and pay data rules.
 *
 * - Salary and CNIC/emergency contacts are never written to the audit trail
 *   in clear text. The audit row records that a change happened, not the value.
 *   Salary history lives in EmployeeSalary (append-only), with restricted reads.
 * - Personal identifiers are returned only to callers with employees.manage.
 */

export const REDACTED = "[REDACTED]";

/** Fields whose values must never be copied into AuditLog snapshots. */
export const SENSITIVE_AUDIT_FIELDS = [
  "cnic",
  "monthlySalaryPaisa",
  "emergencyContact",
  "emergencyPhone",
] as const;

export function redactAuditSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!snapshot) return out;
  for (const [key, value] of Object.entries(snapshot)) {
    out[key] = (SENSITIVE_AUDIT_FIELDS as readonly string[]).includes(key)
      ? REDACTED
      : value;
  }
  return out;
}

/** Keys that identify a personal record, stripped for callers without PII access. */
export const PII_FIELDS = ["cnic", "emergencyContact", "emergencyPhone"] as const;

export function stripPii<T extends Record<string, unknown>>(row: T, canSeePii: boolean): T {
  if (canSeePii) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const key of PII_FIELDS) delete copy[key];
  return copy as T;
}

/** Salary rows that must close when a new salary takes effect. */
export function salaryChanged(before: number, next: number | undefined): boolean {
  return next !== undefined && before !== next;
}