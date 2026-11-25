import { randomBytes } from "node:crypto";
import { Prisma, type EmployeeStatus } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { userHasPermission, userCanAccessBranch } from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import {
  redactAuditSnapshot,
  salaryChanged,
  stripPii,
} from "./employee-privacy";
import { FinanceError } from "@/modules/finance/finance.service";
import type {
  employeeCreateSchema,
  employeeUpdateSchema,
  employeeListSchema,
} from "./employees.schemas";

type CreateInput = z.infer<typeof employeeCreateSchema>;
type UpdateInput = z.infer<typeof employeeUpdateSchema>;
type ListInput = z.infer<typeof employeeListSchema>;

const EMP_NEXT: Record<string, string[]> = {
  ACTIVE: ["INACTIVE", "TERMINATED"],
  INACTIVE: ["ACTIVE", "TERMINATED"],
  TERMINATED: [],
};

// Input field name -> database field name (audit ke liye)
const FIELD_MAP: Record<string, string> = {
  linkedUserId: "userId",
  assignedManagerId: "assignedManagerId",
};

const str = (v?: string | null) => (v && v.trim() ? v.trim() : null);

async function hasAny(userId: string, codes: string[]) {
  for (const c of codes) if (await userHasPermission(userId, c)) return true;
  return false;
}

async function requireBranch(userId: string, branchId: string, perm: string) {
  if (!(await hasAny(userId, [perm, "employees.manage"])))
    throw new FinanceError(403, "Is kaam ki permission nahi hai");
  if (!(await userCanAccessBranch(userId, branchId)))
    throw new FinanceError(403, "Is branch ki access nahi hai");
}

async function canSeeSalary(userId: string) {
  return hasAny(userId, ["salary.view", "salary.manage", "employees.manage"]);
}

function stripSalary<T extends { monthlySalaryPaisa: number }>(row: T, canSee: boolean) {
  if (canSee) return row;
  const copy: Partial<T> = { ...row };
  delete copy.monthlySalaryPaisa;
  return copy;
}

async function validateLinks(
  departmentId?: string | null,
  assignedManagerId?: string | null,
  linkedUserId?: string | null,
) {
  if (departmentId) {
    const d = await db.employeeDepartment.findUnique({
      where: { id: departmentId },
      select: { isActive: true, deletedAt: true },
    });
    if (!d || !d.isActive || d.deletedAt)
      throw new FinanceError(422, "Department nahi mila ya inactive hai");
  }
  if (assignedManagerId) {
    const m = await db.user.findUnique({
      where: { id: assignedManagerId },
      select: { isActive: true, deletedAt: true },
    });
    if (!m || !m.isActive || m.deletedAt)
      throw new FinanceError(422, "Manager user nahi mila ya inactive hai");
  }
  if (linkedUserId) {
    const u = await db.user.findUnique({ where: { id: linkedUserId }, select: { id: true } });
    if (!u) throw new FinanceError(422, "Login account nahi mila");
  }
}

function makeEmployeeCode() {
  const t = Date.now().toString(36).toUpperCase();
  const r = randomBytes(3).toString("hex").toUpperCase();
  return `EMP-${t}-${r}`;
}

function mapUniqueError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
    throw new FinanceError(409, "CNIC ya login account pehle se kisi aur employee ke paas hai");
  throw e;
}

export async function createEmployee(userId: string, input: CreateInput) {
  await requireBranch(userId, input.branchId, "employee.create");
  if (!(await hasAny(userId, ["salary.manage", "employees.manage"])))
    throw new FinanceError(403, "Salary set karne ki permission nahi hai");
  await validateLinks(input.departmentId, input.assignedManagerId, input.linkedUserId);

  try {
    return await db.$transaction(async (tx) => {
      const e = await tx.employee.create({
        data: {
          employeeCode: makeEmployeeCode(),
          branchId: input.branchId,
          fullName: input.fullName.trim(),
          jobTitle: input.jobTitle.trim(),
          joiningDate: new Date(`${input.joiningDate}T00:00:00+05:00`),
          monthlySalaryPaisa: input.monthlySalaryPaisa,
          phone: str(input.phone),
          email: str(input.email),
          address: str(input.address),
          cnic: str(input.cnic),
          emergencyContact: str(input.emergencyContact),
          emergencyPhone: str(input.emergencyPhone),
          profilePictureUrl: str(input.profilePictureUrl),
          departmentId: input.departmentId ?? null,
          assignedManagerId: input.assignedManagerId ?? null,
          userId: input.linkedUserId ?? null,
          status: "ACTIVE",
        },
      });
      await writeAudit(tx, {
        actorId: userId,
        action: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: e.id,
        after: { employeeCode: e.employeeCode, branchId: e.branchId, jobTitle: e.jobTitle },
      });
      await tx.employeeSalary.create({
        data: {
          employeeId: e.id,
          monthlySalaryPaisa: input.monthlySalaryPaisa,
          effectiveFrom: e.joiningDate,
          createdById: userId,
          note: "Initial salary",
        },
      });
      return e;
    });
  } catch (e) {
    return mapUniqueError(e);
  }
}

export async function listEmployees(userId: string, f: ListInput) {
  await requireBranch(userId, f.branchId, "employee.view");

  const where: Prisma.EmployeeWhereInput = {
    branchId: f.branchId,
    deletedAt: null,
    ...(f.status ? { status: f.status as EmployeeStatus } : {}),
    ...(f.departmentId ? { departmentId: f.departmentId } : {}),
    ...(f.q
      ? {
          OR: [
            { fullName: { contains: f.q, mode: "insensitive" } },
            { employeeCode: { contains: f.q, mode: "insensitive" } },
            { phone: { contains: f.q } },
          ],
        }
      : {}),
  };

  const [total, rows, seeSalary] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { department: { select: { id: true, name: true } } },
    }),
    canSeeSalary(userId),
  ]);

  const canSeePii = await hasAny(userId, ["employees.manage"]);
  const items = rows.map((r) => stripPii(stripSalary(r, seeSalary), canSeePii));
  return { total, page: f.page, pageSize: f.pageSize, items, employees: items };
}

export async function getEmployeeProfile(userId: string, id: string) {
  const e = await db.employee.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      assignedManager: { select: { id: true, fullName: true, username: true } },
      user: { select: { id: true, username: true } },
      branch: { select: { id: true, name: true } },
    },
  });
  if (!e || e.deletedAt) throw new FinanceError(404, "Employee nahi mila");
  await requireBranch(userId, e.branchId, "employee.view");
  const canSeePii = await hasAny(userId, ["employees.manage"]);
  return stripPii(stripSalary(e, await canSeeSalary(userId)), canSeePii);
}

function buildUpdate(input: UpdateInput): Prisma.EmployeeUpdateInput {
  const d: Prisma.EmployeeUpdateInput = {};
  if (input.fullName !== undefined) d.fullName = input.fullName.trim();
  if (input.jobTitle !== undefined) d.jobTitle = input.jobTitle.trim();
  if (input.joiningDate !== undefined) d.joiningDate = new Date(`${input.joiningDate}T00:00:00+05:00`);
  if (input.monthlySalaryPaisa !== undefined) d.monthlySalaryPaisa = input.monthlySalaryPaisa;
  if (input.phone !== undefined) d.phone = str(input.phone);
  if (input.email !== undefined) d.email = str(input.email);
  if (input.address !== undefined) d.address = str(input.address);
  if (input.cnic !== undefined) d.cnic = str(input.cnic);
  if (input.emergencyContact !== undefined) d.emergencyContact = str(input.emergencyContact);
  if (input.emergencyPhone !== undefined) d.emergencyPhone = str(input.emergencyPhone);
  if (input.profilePictureUrl !== undefined) d.profilePictureUrl = str(input.profilePictureUrl);
  if (input.departmentId !== undefined)
    d.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
  if (input.assignedManagerId !== undefined)
    d.assignedManager = input.assignedManagerId
      ? { connect: { id: input.assignedManagerId } }
      : { disconnect: true };
  if (input.linkedUserId !== undefined)
    d.user = input.linkedUserId ? { connect: { id: input.linkedUserId } } : { disconnect: true };
  return d;
}

export async function updateEmployee(userId: string, id: string, input: UpdateInput) {
  const before = await db.employee.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new FinanceError(404, "Employee nahi mila");
  await requireBranch(userId, before.branchId, "employee.update");

  if (input.monthlySalaryPaisa !== undefined && !(await hasAny(userId, ["salary.manage", "employees.manage"])))
    throw new FinanceError(403, "Salary badalne ki permission nahi hai");
  await validateLinks(input.departmentId, input.assignedManagerId, input.linkedUserId);

  const keys = Object.keys(input) as (keyof UpdateInput)[];
  const dbKey = (k: string) => FIELD_MAP[k] ?? k;
  const beforeSnap = redactAuditSnapshot(
    Object.fromEntries(
      keys.map((k) => [k, (before as Record<string, unknown>)[dbKey(k)] ?? null]),
    ),
  );

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.employee.update({ where: { id }, data: buildUpdate(input) });
      const afterSnap = redactAuditSnapshot(
        Object.fromEntries(
          keys.map((k) => [k, (updated as Record<string, unknown>)[dbKey(k)] ?? null]),
        ),
      );
      if (salaryChanged(before.monthlySalaryPaisa, input.monthlySalaryPaisa)) {
        const now = new Date();
        // Close the open salary row, then append the new one. Rows are never edited.
        await tx.employeeSalary.updateMany({
          where: { employeeId: id, effectiveTo: null },
          data: { effectiveTo: now },
        });
        await tx.employeeSalary.create({
          data: {
            employeeId: id,
            monthlySalaryPaisa: input.monthlySalaryPaisa as number,
            effectiveFrom: now,
            createdById: userId,
            note: "Salary change",
          },
        });
      }
      await writeAudit(tx, {
        actorId: userId,
        action: "EMPLOYEE_UPDATED",
        entityType: "Employee",
        entityId: id,
        before: beforeSnap as Prisma.InputJsonObject,
        after: afterSnap as Prisma.InputJsonObject,
      });
      return updated;
    });
  } catch (e) {
    return mapUniqueError(e);
  }
}

export async function changeEmployeeStatus(
  userId: string,
  id: string,
  to: "ACTIVE" | "INACTIVE" | "TERMINATED",
  reason?: string,
) {
  const emp = await db.employee.findUnique({
    where: { id },
    include: { user: { select: { id: true, isActive: true, role: { select: { code: true } } } } },
  });
  if (!emp || emp.deletedAt) throw new FinanceError(404, "Employee nahi mila");
  await requireBranch(userId, emp.branchId, "employee.deactivate");

  if (!EMP_NEXT[emp.status].includes(to))
    throw new FinanceError(409, `${emp.status} se ${to} allowed nahi hai`);

  // A leaving employee must lose login access. Keep the linked account
  // consistent with the employee status in the same transaction.
  const linked = to !== "ACTIVE" ? emp.user : null;
  if (linked) {
    if (linked.id === userId)
      throw new FinanceError(409, "Apna employee record deactivate nahi kar sakte");
    if (linked.role.code === "OWNER")
      throw new FinanceError(409, "OWNER account wale employee ka status yahan se nahi badal sakte");
  }

  return db.$transaction(async (tx) => {
    const res = await tx.employee.updateMany({
      where: { id, status: emp.status },
      data: { status: to },
    });
    if (res.count === 0) throw new FinanceError(409, "Status abhi badal chuka hai, dobara try karein");

    if (linked && linked.isActive) {
      await tx.user.update({ where: { id: linked.id }, data: { isActive: false } });
      await tx.session.updateMany({
        where: { userId: linked.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        actorId: userId,
        action: "USER_DEACTIVATED_BY_EMPLOYEE_STATUS",
        entityType: "User",
        entityId: linked.id,
        before: { isActive: true },
        after: { isActive: false, employeeId: id, employeeStatus: to },
        reason,
      });
    }

    await writeAudit(tx, {
      actorId: userId,
      action: "EMPLOYEE_STATUS_CHANGED",
      entityType: "Employee",
      entityId: id,
      before: { status: emp.status },
      after: { status: to, linkedUserDeactivated: Boolean(linked?.isActive) },
      reason,
    });
    return tx.employee.findUnique({ where: { id } });
  });
}