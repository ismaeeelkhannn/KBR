import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { decideApprovalSchema } from "@/modules/approvals/approval.schemas";
import {
  ApprovalError,
  decideApproval,
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

  const parsed = decideApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Decision APPROVED ya REJECTED hona chahiye" },
      { status: 400 }
    );
  }

  try {
    const approval = await decideApproval(
      user.id,
      id,
      parsed.data.decision,
      parsed.data.note
    );
    return NextResponse.json({ ok: true, approval });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Approval decide error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
