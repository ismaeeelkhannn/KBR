import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { menuCategoryUpdateSchema } from "@/modules/admin/admin-menu.schemas";
import { updateMenuCategory } from "@/modules/admin/admin-menu.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = menuCategoryUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const category = await updateMenuCategory(actor.id, id, parsed.data);
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    return errorResponse(error, "Admin menu category update");
  }
}
