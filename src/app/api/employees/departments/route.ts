import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/session";
import { db } from "@/lib/db";
import { FinanceError } from "@/modules/finance/finance.service";
import { userHasPermission } from "@/modules/access-control/permissions";

const departmentCreateSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  if (
    !(await userHasPermission(user.id, "employee.view")) &&
    !(await userHasPermission(user.id, "employees.manage"))
  ) {
    return NextResponse.json({ error: "Is kaam ki permission nahi hai" }, { status: 403 });
  }

  const departments = await db.employeeDepartment.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, departments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  if (
    !(await userHasPermission(user.id, "employee.create")) &&
    !(await userHasPermission(user.id, "employees.manage"))
  ) {
    return NextResponse.json({ error: "Is kaam ki permission nahi hai" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }
  const parsed = departmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input ghalat hai", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const code = parsed.data.code.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!code) throw new FinanceError(422, "Department code ghalat hai");
    const department = await db.employeeDepartment.create({
      data: { ...parsed.data, code },
    });
    return NextResponse.json({ ok: true, department }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Employee department create");
  }
}
