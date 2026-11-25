import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { FinanceError } from "@/modules/finance/finance.service";
import { getDailyReport } from "@/modules/reports/daily-report.service";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login zaroori hai" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId") ?? "";
  const date = url.searchParams.get("date") ?? "";

  if (!branchId || !date) {
    return NextResponse.json(
      { error: "branchId aur date zaroori hain" },
      { status: 400 }
    );
  }

  try {
    const report = await getDailyReport(user.id, branchId, date);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof FinanceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Daily report error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
