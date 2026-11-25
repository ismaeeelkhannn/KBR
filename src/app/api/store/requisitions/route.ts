import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { requisitionSchema } from "@/modules/store/store.schemas";
import {
  createRequisition,
  listRequisitions,
  StoreError,
} from "@/modules/store/store.service";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  const branchId = new URL(request.url).searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json({ error: "branchId zaroori hai" }, { status: 400 });
  }

  try {
    const requisitions = await listRequisitions(user.id, branchId);
    return NextResponse.json({ ok: true, requisitions });
  } catch (error) {
    if (error instanceof StoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Requisition list error:", error);
    return NextResponse.json({ error: "Server mein masla aaya" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }

  const parsed = requisitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const requisition = await createRequisition(user.id, parsed.data);
    return NextResponse.json({ ok: true, requisition }, { status: 201 });
  } catch (error) {
    if (error instanceof StoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Requisition create error:", error);
    return NextResponse.json({ error: "Server mein masla aaya" }, { status: 500 });
  }
}
