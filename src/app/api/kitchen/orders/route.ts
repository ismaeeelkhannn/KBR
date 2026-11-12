import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import {
  KitchenError,
  listKitchenOrders,
} from "@/modules/kitchen/kitchen.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  try {
    const orders = await listKitchenOrders(user.id);
    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    if (error instanceof KitchenError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Kitchen list error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
