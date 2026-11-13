import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { changeStatusSchema } from "@/modules/kitchen/kitchen.schemas";
import {
  changeOrderStatus,
  KitchenError,
} from "@/modules/kitchen/kitchen.service";

export async function PATCH(
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

  const parsed = changeStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Status ghalat hai" },
      { status: 400 }
    );
  }

  try {
    const order = await changeOrderStatus(user.id, id, parsed.data.to);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    if (error instanceof KitchenError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Status change error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
