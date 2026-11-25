import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import {
  complaintSchema,
  complaintStatusFilterSchema,
} from "@/modules/operations/operations.schemas";
import { createComplaint } from "@/modules/operations/operations.service";
import {
  userHasPermission,
  userCanAccessBranch,
} from "@/modules/access-control/permissions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login zaroori hai" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId") ?? "";
  const requestedStatus = url.searchParams.get("status");
  if (!branchId) {
    return NextResponse.json(
      { error: "branchId zaroori hai" },
      { status: 400 }
    );
  }

  const parsedStatus = requestedStatus
    ? complaintStatusFilterSchema.safeParse(requestedStatus)
    : null;
  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json(
      { error: "Status ghalat hai" },
      { status: 400 }
    );
  }

  try {
    if (
      !(await userHasPermission(user.id, "complaints.manage")) ||
      !(await userCanAccessBranch(user.id, branchId))
    ) {
      return NextResponse.json({ error: "Access nahi hai" }, { status: 403 });
    }

    const complaints = await db.complaint.findMany({
      where: {
        branchId,
        ...(parsedStatus?.success ? { status: parsedStatus.data } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ ok: true, complaints });
  } catch (error) {
    return errorResponse(error, "Complaint list");
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login zaroori hai" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request JSON nahi hai" },
      { status: 400 }
    );
  }

  const parsed = complaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const complaint = await createComplaint(user.id, parsed.data);
    return NextResponse.json({ ok: true, complaint }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Complaint create");
  }
}
