import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { adminUserUpdateSchema } from "@/modules/admin/admin-users.schemas";
import { updateAdminUser } from "@/modules/admin/admin-users.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }

  const parsed = adminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await updateAdminUser(actor.id, id, parsed.data);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error, "Admin user update");
  }
}
