import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/modules/auth/session";
import { userHasPermission } from "@/modules/access-control/permissions";
import { db } from "@/lib/db";
import { EmployeesClient } from "./employees-client";

async function EmployeesContent() {
  await connection();
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const [canView, canCreate, canUpdate, canDeactivate, canManageUsers, canManageRoles, canManageMenu, canViewCancellations] =
    await Promise.all([
      userHasPermission(actor.id, "employee.view"),
      userHasPermission(actor.id, "employee.create"),
      userHasPermission(actor.id, "employee.update"),
      userHasPermission(actor.id, "employee.deactivate"),
      userHasPermission(actor.id, "users.manage"),
      userHasPermission(actor.id, "roles.manage"),
      userHasPermission(actor.id, "settings.manage"),
      userHasPermission(actor.id, "reports.view"),
    ]);
  if (!canView && !(await userHasPermission(actor.id, "employees.manage")) && actor.role.code !== "OWNER") {
    redirect("/dashboard");
  }

  const owner = actor.role.code === "OWNER";
  const [employees, branches, departments, loginUsers] = await Promise.all([
    db.employee.findMany({
      where: {
        deletedAt: null,
        ...(owner ? {} : { branch: { userAccess: { some: { userId: actor.id } } } }),
      },
      orderBy: { fullName: "asc" },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        assignedManager: { select: { id: true, fullName: true } },
        user: { select: { id: true, username: true, isActive: true } },
      },
    }),
    db.branch.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(owner ? {} : { userAccess: { some: { userId: actor.id } } }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.employeeDepartment.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(owner ? {} : {
          branchAccess: {
            some: {
              branch: { userAccess: { some: { userId: actor.id } } },
            },
          },
        }),
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, username: true },
    }),
  ]);

  const employeeRows = employees.map((employee) => ({
    ...employee,
    joiningDate: employee.joiningDate.toISOString().slice(0, 10),
  }));

  return (
    <AppShell
      userName={actor.fullName}
      role={actor.role.name}
      canManageUsers={canManageUsers}
      canManageRoles={canManageRoles}
      canManageMenu={canManageMenu}
      canViewCancellations={canViewCancellations}
      canViewEmployees
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <p className="text-sm text-slate-400">Human resources</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Employees</h1>
          <p className="mt-1 text-sm text-slate-400">Profiles, branches, departments and employment status.</p>
        </div>
        <EmployeesClient
          employees={employeeRows}
          branches={branches}
          departments={departments}
          loginUsers={loginUsers}
          canCreate={canCreate || (await userHasPermission(actor.id, "employees.manage")) || owner}
          canUpdate={canUpdate || (await userHasPermission(actor.id, "employees.manage")) || owner}
          canDeactivate={canDeactivate || (await userHasPermission(actor.id, "employees.manage")) || owner}
        />
      </div>
    </AppShell>
  );
}

export default function AdminEmployeesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen animate-pulse bg-[#0b1020]" aria-label="Loading employees" />}>
      <EmployeesContent />
    </Suspense>
  );
}
