import { businessDay } from "./dashboard-metrics";

/**
 * A day can only be closed after it has ended in the restaurant's timezone.
 * Closing today (or a future day) would freeze partial sales and later
 * orders would silently fall outside the closed report.
 */
export function closingDateDecision(
  date: string,
  now: Date,
  timeZone: string,
): { allowed: true } | { allowed: false; reason: string } {
  const today = businessDay(now, timeZone);
  if (date >= today) {
    return { allowed: false, reason: `${date} abhi khatam nahi hua; sirf guzre din band kar sakte hain` };
  }
  return { allowed: true };
}
