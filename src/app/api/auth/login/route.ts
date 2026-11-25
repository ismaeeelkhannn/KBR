import { NextResponse } from "next/server";
import { loginSchema } from "@/modules/auth/auth.schemas";
import { login, AuthError } from "@/modules/auth/auth.service";
import { checkRateLimit } from "@/modules/auth/rate-limit";
import {
  loginRateLimitKeys,
  resolveClientIp,
} from "@/modules/auth/login-rate-key";

export async function POST(request: Request) {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const ipAddress = resolveClientIp(
    request.headers.get("x-forwarded-for"),
    trustProxy,
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Username aur password zaroori hain" },
      { status: 400 }
    );
  }

  // Limits are checked after the username is known, so each username has its
  // own bucket. Every key must allow the request.
  for (const key of loginRateLimitKeys({ username: parsed.data.username, ip: ipAddress })) {
    const limit = checkRateLimit(key);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Bahut zyada koshishen. Thori dair baad try karein." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }
  }

  try {
    const user = await login({
      username: parsed.data.username,
      password: parsed.data.password,
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Login error:", error);
    return NextResponse.json({ error: "Server mein masla aaya" }, { status: 500 });
  }
}
