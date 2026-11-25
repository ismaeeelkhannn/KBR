import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { menuVariantUpdateSchema } from "@/modules/admin/admin-menu.schemas";
import { updateMenuVariant } from "@/modules/admin/admin-menu.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = menuVariantUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const variant = await updateMenuVariant(actor.id, id, parsed.data);
    return NextResponse.json({ ok: true, variant });
  } catch (error) {
    return errorResponse(error, "Admin menu variant update");
  }
}
