import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/session";
import {
  createRecipeVersion,
  latestRecipeVersion,
  RecipeError,
} from "@/modules/recipes/recipe.service";

const updateRecipeSchema = z.object({
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantityBase: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { variantId } = await params;
  const recipe = await latestRecipeVersion(variantId);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe nahi mili" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, recipe });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { variantId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request JSON nahi hai" },
      { status: 400 }
    );
  }

  const parsed = updateRecipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "lines array zaroori hai" },
      { status: 400 }
    );
  }

  try {
    const recipe = await createRecipeVersion(
      user.id,
      variantId,
      parsed.data.lines
    );
    return NextResponse.json({ ok: true, recipe }, { status: 201 });
  } catch (error) {
    if (error instanceof RecipeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Recipe error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
