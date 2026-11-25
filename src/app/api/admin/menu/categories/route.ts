import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { menuCategoryCreateSchema } from "@/modules/admin/admin-menu.schemas";
import { createMenuCategory } from "@/modules/admin/admin-menu.service";

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const parsed = menuCategoryCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const category = await createMenuCategory(actor.id, parsed.data);
    return NextResponse.json({ ok: true, category }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Admin menu category create");
  }
}
