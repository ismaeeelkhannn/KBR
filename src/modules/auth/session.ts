import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Database session management.
 * - Cookie mein random token jata hai.
 * - Database mein sirf us ka SHA-256 hash save hota hai.
 *   Agar database leak ho to bhi koi valid cookie nahi banti.
 * - Session 8 ghante ke liye valid hai.
 */

export const SESSION_COOKIE_NAME = "kbr_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(params: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      userId: params.userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Cookie se current user nikalta hai.
 * Session expired, revoked, ya user inactive/deleted ho to null.
 */
export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true } } },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt <= new Date()) return null;
  if (!session.user.isActive || session.user.deletedAt) return null;

  return session.user;
}

/**
 * Logout: session database mein revoke hota hai aur cookie delete hoti hai.
 * Row delete nahi hoti, taake audit history bani rahe.
 */
export async function endCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  store.delete(SESSION_COOKIE_NAME);
}
