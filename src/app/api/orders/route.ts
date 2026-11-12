import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { createOrderSchema } from "@/modules/orders/order.schemas";
import { createOrder, OrderError } from "@/modules/orders/order.service";

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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Input ghalat hai",
        details: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 }
    );
  }

  try {
    const result = await createOrder(user.id, parsed.data);
    return NextResponse.json(
      { ok: true, replayed: result.replayed, order: result.order },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Order error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
