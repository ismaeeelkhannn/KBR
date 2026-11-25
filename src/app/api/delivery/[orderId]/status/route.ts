import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { errorResponse } from "@/lib/http";
import { deliveryStatusSchema } from "@/modules/operations/operations.schemas";
import { changeDeliveryStatus } from "@/modules/operations/operations.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login zaroori hai" },
      { status: 401 }
    );
  }

  const { orderId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request JSON nahi hai" },
      { status: 400 }
    );
  }

  const parsed = deliveryStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const delivery = await changeDeliveryStatus(
      user.id,
      orderId,
      parsed.data.to,
      parsed.data.riderUserId
    );
    return NextResponse.json({ ok: true, delivery });
  } catch (error) {
    return errorResponse(error, "Delivery status");
  }
}
