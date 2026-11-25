/**
 * Pure helpers that decide which rate-limit keys a login attempt uses.
 *
 * Why not just X-Forwarded-For: that header is set by the client unless a
 * trusted reverse proxy overwrites it. Trusting it blindly lets an attacker
 * rotate the value on every request and never hit the limit.
 *
 * Policy:
 * - The username key is always used (normalized, so "Ali" and " ali " share a bucket).
 * - The client IP key is used only when TRUST_PROXY=true, meaning the app sits
 *   behind a proxy that overwrites X-Forwarded-For. Otherwise no IP key is used.
 */

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function resolveClientIp(
  forwardedFor: string | null,
  trustProxy: boolean,
): string | null {
  if (!trustProxy || !forwardedFor) return null;
  const first = forwardedFor.split(",")[0]?.trim();
  return first ? first : null;
}

export function loginRateLimitKeys(input: {
  username: string;
  ip: string | null;
}): string[] {
  const keys = [`login:user:${normalizeUsername(input.username)}`];
  if (input.ip) keys.push(`login:ip:${input.ip}`);
  return keys;
}
