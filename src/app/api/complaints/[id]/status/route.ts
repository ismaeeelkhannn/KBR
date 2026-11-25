import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { errorResponse } from "@/lib/http";
import { complaintStatusSchema } from "@/modules/operations/operations.schemas";
import { changeComplaintStatus } from "@/modules/operations/operations.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login zaroori hai" },
      { status: 401 }
    );
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

  const parsed = complaintStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const complaint = await changeComplaintStatus(
      user.id,
      id,
      parsed.data.to,
      parsed.data.note
    );
    return NextResponse.json({ ok: true, complaint });
  } catch (error) {
    return errorResponse(error, "Complaint status");
  }
}
