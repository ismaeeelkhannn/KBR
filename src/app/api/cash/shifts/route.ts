import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { CashError, openShift } from "@/modules/cash/cash-shift.service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
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
    !("cashRegisterId" in body) ||
    !("openingCashPaisa" in body) ||
    typeof body.cashRegisterId !== "string" ||
    typeof body.openingCashPaisa !== "number"
  ) {
    return NextResponse.json(
      { error: "cashRegisterId aur openingCashPaisa zaroori hain" },
      { status: 400 }
    );
  }

  try {
    const shift = await openShift(user.id, {
      cashRegisterId: body.cashRegisterId,
      openingCashPaisa: body.openingCashPaisa,
    });
    return NextResponse.json({ ok: true, shift }, { status: 201 });
  } catch (error) {
    if (error instanceof CashError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Open shift error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
