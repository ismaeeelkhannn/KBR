import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/modules/auth/session";
import { userHasPermission } from "@/modules/access-control/permissions";
import { getAdminUserDirectory } from "@/modules/admin/admin-users.service";
import { UsersClient } from "./users-client";

async function AdminUsersContent() {
  await connection();
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const canManageUsers = await userHasPermission(actor.id, "users.manage");
  if (!canManageUsers) redirect("/dashboard");

  const [canManageRoles, canManageMenu, canViewCancellations] = await Promise.all([
    userHasPermission(actor.id, "roles.manage"),
    userHasPermission(actor.id, "settings.manage"),
    userHasPermission(actor.id, "reports.view"),
  ]);
  const canViewEmployees =
    actor.role.code === "OWNER" ||
    (await userHasPermission(actor.id, "employee.view")) ||
    (await userHasPermission(actor.id, "employees.manage"));
  const directory = await getAdminUserDirectory(actor.id);

  return (
    <AppShell
      userName={actor.fullName}
      role={actor.role.name}
      canManageUsers
      canManageRoles={canManageRoles}
      canManageMenu={canManageMenu}
      canViewCancellations={canViewCancellations}
      canViewEmployees={canViewEmployees}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <p className="text-sm text-slate-400">Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Users & access
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            User accounts, existing roles aur branch access manage karein.
          </p>
        </div>
        <UsersClient
          users={directory.users}
          roles={directory.roles}
          branches={directory.branches}
          canManageRoles={canManageRoles}
        />
      </div>
    </AppShell>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen animate-pulse bg-[#0b1020]"
          aria-label="Loading user management"
        />
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
