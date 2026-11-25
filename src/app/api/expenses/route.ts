import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { expenseSchema } from "@/modules/finance/finance.schemas";
import {
  createExpense,
  FinanceError,
} from "@/modules/finance/finance.service";

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

  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { expense, replayed } = await createExpense(user.id, parsed.data);
    return NextResponse.json(
      { ok: true, replayed, expense },
      { status: replayed ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof FinanceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Expense error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
