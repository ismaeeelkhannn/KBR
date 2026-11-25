import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { menuProductUpdateSchema } from "@/modules/admin/admin-menu.schemas";
import { updateMenuProduct } from "@/modules/admin/admin-menu.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = menuProductUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const product = await updateMenuProduct(actor.id, id, parsed.data);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return errorResponse(error, "Admin menu product update");
  }
}
