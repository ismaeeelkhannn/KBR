import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import {
  getStockBalances,
  InventoryError,
} from "@/modules/inventory/inventory.service";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const branchId = new URL(request.url).searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json(
      { error: "branchId zaroori hai" },
      { status: 400 }
    );
  }

  try {
    const stock = await getStockBalances(user.id, branchId);
    return NextResponse.json({ ok: true, stock });
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Stock error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
