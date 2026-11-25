import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { verifyMenuPrice } from "@/modules/admin/admin-menu.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await verifyMenuPrice(actor.id, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error, "Admin menu price verify");
  }
}
