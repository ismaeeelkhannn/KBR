import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import {
  decideRequisition,
  decisionSchema,
} from "@/modules/store/requisition-decision";
import { StoreError } from "@/modules/store/store.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }

  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const requisition = await decideRequisition(user.id, id, parsed.data);
    return NextResponse.json({ ok: true, requisition });
  } catch (error) {
    if (error instanceof StoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Requisition decision error:", error);
    return NextResponse.json({ error: "Server mein masla aaya" }, { status: 500 });
  }
}