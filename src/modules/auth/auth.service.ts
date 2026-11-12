import { db } from "@/lib/db";
import { verifyPassword } from "./password";
import { createSession } from "./session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID_CREDENTIALS = "Username ya password ghalat hai";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function login(input: {
  username: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const user = await db.user.findUnique({
    where: { username: input.username },
    include: { role: true },
  });

  if (!user || !user.isActive || user.deletedAt) {
    throw new AuthError(INVALID_CREDENTIALS, 401);
  }

  const now = new Date();

  if (user.lockedUntil && user.lockedUntil > now) {
    throw new AuthError(INVALID_CREDENTIALS, 401);
  }

  const isValid = await verifyPassword(user.passwordHash, input.password);

  if (!isValid) {
    const attempts = user.failedLoginCount + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000)
          : null,
      },
    });

    throw new AuthError(INVALID_CREDENTIALS, 401);
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });

  await createSession({
    userId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role.code,
  };
}
