import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { CashError, closeShift } from "@/modules/cash/cash-shift.service";
import { closeShiftSchema } from "@/modules/payments/payment.schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request JSON nahi hai" },
      { status: 400 }
    );
  }

  const parsed = closeShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "countedCashPaisa zaroori hai" },
      { status: 400 }
    );
  }

  try {
    const shift = await closeShift(user.id, id, parsed.data);
    return NextResponse.json({ ok: true, shift });
  } catch (error) {
    if (error instanceof CashError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Close shift error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
