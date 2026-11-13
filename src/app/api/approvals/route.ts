import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import {
  ApprovalError,
  listPendingApprovals,
} from "@/modules/approvals/approval.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  try {
    const approvals = await listPendingApprovals(user.id);
    return NextResponse.json({ ok: true, approvals });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Approvals list error:", error);
    return NextResponse.json(
      { error: "Server mein masla aaya" },
      { status: 500 }
    );
  }
}
