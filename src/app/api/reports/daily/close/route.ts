import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { FinanceError } from "@/modules/finance/finance.service";
import { closeDay } from "@/modules/reports/daily-report.service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login zaroori hai" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request JSON nahi hai" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("branchId" in body) ||
    !("date" in body) ||
    typeof body.branchId !== "string" ||
    !body.branchId ||
    typeof body.date !== "string" ||
    !body.date
  ) {
    return NextResponse.json(
      { error: "branchId aur date zaroori hain" },
      { status: 400 }
    );
  }

  try {
    const { closing, report } = await closeDay(
      user.id,
      body.branchId,
      body.date
    );
    return NextResponse.json({ ok: true, closing, report }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Day close error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
