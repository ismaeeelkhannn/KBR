import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { paySchema } from "@/modules/payments/payment.schemas";
import {
  PaymentError,
  recordPayment,
} from "@/modules/payments/payment.service";

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

  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payment ka input ghalat hai" },
      { status: 400 }
    );
  }

  try {
    const result = await recordPayment(user.id, id, parsed.data);
    return NextResponse.json(
      { ok: true, replayed: result.replayed, payment: result.payment },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
