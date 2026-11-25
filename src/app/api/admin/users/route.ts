import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import {
  adminUserCreateSchema,
} from "@/modules/admin/admin-users.schemas";
import {
  createAdminUser,
  getAdminUserDirectory,
} from "@/modules/admin/admin-users.service";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  try {
    const directory = await getAdminUserDirectory(actor.id);
    return NextResponse.json({ ok: true, ...directory });
  } catch (error) {
    return errorResponse(error, "Admin users list");
  }
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }

  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await createAdminUser(actor.id, parsed.data);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Admin user create");
  }
}
