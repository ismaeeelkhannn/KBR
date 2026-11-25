import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/modules/auth/session";
import { userHasPermission } from "@/modules/access-control/permissions";
import { getAdminRoleDirectory } from "@/modules/admin/admin-roles.service";
import { RolesClient } from "./roles-client";

async function AdminRolesContent() {
  await connection();
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const canManageRoles = await userHasPermission(actor.id, "roles.manage");
  if (!canManageRoles) redirect("/dashboard");

  const [directory, canManageUsers, canManageMenu, canViewCancellations] =
    await Promise.all([
    getAdminRoleDirectory(actor.id),
    userHasPermission(actor.id, "users.manage"),
    userHasPermission(actor.id, "settings.manage"),
    userHasPermission(actor.id, "reports.view"),
  ]);
  const canViewEmployees =
    actor.role.code === "OWNER" ||
    (await userHasPermission(actor.id, "employee.view")) ||
    (await userHasPermission(actor.id, "employees.manage"));

  return (
    <AppShell
      userName={actor.fullName}
      role={actor.role.name}
      canManageUsers={canManageUsers}
      canManageRoles
      canManageMenu={canManageMenu}
      canViewCancellations={canViewCancellations}
      canViewEmployees={canViewEmployees}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <p className="text-sm text-slate-400">Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Role permissions
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Baghair schema change ke existing roles ka access control karein.
          </p>
        </div>
        <RolesClient
          roles={directory.roles}
          permissions={directory.permissions}
          actorRoleId={directory.actorRoleId}
        />
      </div>
    </AppShell>
  );
}

export default function AdminRolesPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen animate-pulse bg-[#0b1020]"
          aria-label="Loading role permissions"
        />
      }
    >
      <AdminRolesContent />
    </Suspense>
  );
}
