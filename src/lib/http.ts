import { NextResponse } from "next/server";
import { FinanceError } from "@/modules/finance/finance.service";

export function errorResponse(error: unknown, label: string) {
  if (error instanceof FinanceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  console.error(`${label} error:`, error);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
