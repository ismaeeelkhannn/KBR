import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { employeeCreateSchema, employeeListSchema } from "@/modules/employees/employees.schemas";
import { createEmployee, listEmployees } from "@/modules/employees/employees.service";
import { errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const parsed = employeeListSchema.safeParse({
    branchId: sp.get("branchId") ?? "",
    status: sp.get("status") ?? undefined,
    departmentId: sp.get("departmentId") ?? undefined,
    q: sp.get("q") ?? undefined,
    page: sp.get("page") ?? undefined,
    pageSize: sp.get("pageSize") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "Input ghalat hai", issues: parsed.error.issues }, { status: 400 });

  try {
    const result = await listEmployees(user.id, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return errorResponse(e, "Employee list");
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });

  const parsed = employeeCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Input ghalat hai", issues: parsed.error.issues }, { status: 400 });

  try {
    const employee = await createEmployee(user.id, parsed.data);
    return NextResponse.json({ ok: true, employee }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Employee create");
  }
}