import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { getAdminRoleDirectory } from "@/modules/admin/admin-roles.service";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  try {
    const directory = await getAdminRoleDirectory(actor.id);
    return NextResponse.json({ ok: true, ...directory });
  } catch (error) {
    return errorResponse(error, "Admin roles list");
  }
}
