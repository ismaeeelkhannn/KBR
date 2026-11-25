export type ItemCodeLookup<T> =
  | { status: "empty" }
  | { status: "not_found" }
  | { status: "ambiguous" }
  | { status: "found"; item: T };

export function findItemByCode<T extends { code: string }>(
  items: T[],
  input: string,
): ItemCodeLookup<T> {
  const code = input.trim().toUpperCase();
  if (!code) return { status: "empty" };

  const matches = items.filter(
    (item) => item.code.trim().toUpperCase() === code,
  );
  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "found", item: matches[0] };
}
