import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/modules/auth/session";
import { userHasPermission } from "@/modules/access-control/permissions";
import { getAdminMenu } from "@/modules/admin/admin-menu.service";
import { MenuClient } from "./menu-client";

async function AdminMenuContent() {
  await connection();
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const [
    canManageMenu,
    canManageUsers,
    canManageRoles,
    canViewCancellations,
  ] = await Promise.all([
    userHasPermission(actor.id, "settings.manage"),
    userHasPermission(actor.id, "users.manage"),
    userHasPermission(actor.id, "roles.manage"),
    userHasPermission(actor.id, "reports.view"),
  ]);
  if (!canManageMenu) redirect("/dashboard");
  const canViewEmployees =
    actor.role.code === "OWNER" ||
    (await userHasPermission(actor.id, "employee.view")) ||
    (await userHasPermission(actor.id, "employees.manage"));

  const categories = await getAdminMenu(actor.id);

  return (
    <AppShell
      userName={actor.fullName}
      role={actor.role.name}
      canManageUsers={canManageUsers}
      canManageRoles={canManageRoles}
      canManageMenu
      canViewCancellations={canViewCancellations}
      canViewEmployees={canViewEmployees}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <p className="text-sm text-slate-400">Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Menu management
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Catalog yahan se manage hoga aur public menu/POS mein wahi active
            items aur current prices use honge.
          </p>
        </div>
        <MenuClient categories={categories} />
      </div>
    </AppShell>
  );
}

export default function AdminMenuPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen animate-pulse bg-[#0b1020]"
          aria-label="Loading menu management"
        />
      }
    >
      <AdminMenuContent />
    </Suspense>
  );
}
