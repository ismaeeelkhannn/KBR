import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { employeeUpdateSchema } from "@/modules/employees/employees.schemas";
import { getEmployeeProfile, updateEmployee } from "@/modules/employees/employees.service";
import { errorResponse } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });

  const { id } = await params;
  try {
    const employee = await getEmployeeProfile(user.id, id);
    return NextResponse.json({ ok: true, employee });
  } catch (e) {
    return errorResponse(e, "Employee profile");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });

  const { id } = await params;
  const parsed = employeeUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Input ghalat hai", issues: parsed.error.issues }, { status: 400 });

  try {
    const employee = await updateEmployee(user.id, id, parsed.data);
    return NextResponse.json({ ok: true, employee });
  } catch (e) {
    return errorResponse(e, "Employee update");
  }
}