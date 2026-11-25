export function pctChange(
  current: number,
  previous: number,
): number | "new" | null {
  if (previous === 0) {
    return current === 0 ? null : "new";
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

export function netIncome({
  sales = 0,
  refunds = 0,
  expenses = 0,
}: {
  sales?: number;
  refunds?: number;
  expenses?: number;
}): number {
  return sales - refunds - expenses;
}

export function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;
}

export function businessDay(timestamp: Date | string, timeZone: string): string {
  const date =
    timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid timestamp");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format business day");
  }

  return `${year}-${month}-${day}`;
}
