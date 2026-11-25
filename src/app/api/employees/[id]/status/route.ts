import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { employeeStatusSchema } from "@/modules/employees/employees.schemas";
import { changeEmployeeStatus } from "@/modules/employees/employees.service";

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

  const parsed = employeeStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const employee = await changeEmployeeStatus(
      user.id,
      id,
      parsed.data.to,
      parsed.data.reason
    );
    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    return errorResponse(error, "Employee status");
  }
}
