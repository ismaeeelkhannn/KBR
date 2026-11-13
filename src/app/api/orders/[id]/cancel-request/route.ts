import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { cancelRequestSchema } from "@/modules/approvals/approval.schemas";
import {
  ApprovalError,
  requestOrderCancel,
} from "@/modules/approvals/approval.service";

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
    return NextResponse.json(
      { error: "Request JSON nahi hai" },
      { status: 400 }
    );
  }

  const parsed = cancelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Cancel ki wajah (3+ characters) zaroori hai" },
      { status: 400 }
    );
  }

  try {
    const approval = await requestOrderCancel(user.id, id, parsed.data.reason);
    return NextResponse.json({ ok: true, approval }, { status: 201 });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Cancel request error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
