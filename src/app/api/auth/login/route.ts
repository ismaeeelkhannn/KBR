import { NextResponse } from "next/server";
import { loginSchema } from "@/modules/auth/auth.schemas";
import { login, AuthError } from "@/modules/auth/auth.service";
import { checkRateLimit } from "@/modules/auth/rate-limit";

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

  const limit = checkRateLimit(ipAddress ?? "unknown");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Bahut zyada koshishen. Thori dair baad try karein." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

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
