import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { getAdminMenu } from "@/modules/admin/admin-menu.service";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  try {
    const categories = await getAdminMenu(actor.id);
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    return errorResponse(error, "Admin menu list");
  }
}
