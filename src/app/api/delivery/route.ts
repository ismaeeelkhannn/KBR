import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { errorResponse } from "@/lib/http";
import { deliverySchema } from "@/modules/operations/operations.schemas";
import { createDelivery } from "@/modules/operations/operations.service";

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

  const parsed = deliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const delivery = await createDelivery(user.id, parsed.data);
    return NextResponse.json({ ok: true, delivery }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Delivery create");
  }
}
