"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Login nahi hua";
        setError(message);
        setLoading(false);
        return;
      }

      const next =
        new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
      const target = new URL(next, window.location.origin);
      const safeNext =
        next.startsWith("/") && target.origin === window.location.origin
          ? target.href
          : new URL("/dashboard", window.location.origin).href;

      window.location.assign(safeNext);
    } catch {
      setError("Server se rabta nahi ho saka");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-bold">Login</h1>

        <input
          name="username"
          placeholder="Username"
          autoComplete="username"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          className="rounded border p-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black p-2 text-white disabled:opacity-50"
        >
          {loading ? "Ruk jayein..." : "Login"}
        </button>
      </form>
    </main>
  );
}
