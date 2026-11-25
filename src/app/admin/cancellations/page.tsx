import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/modules/auth/session";
import { userHasPermission } from "@/modules/access-control/permissions";
import {
  getCancellationReport,
  listCancellableOrders,
} from "@/modules/approvals/cancellation-report.service";
import {
  listPendingApprovals,
} from "@/modules/approvals/approval.service";
import { CancellationsClient } from "./cancellations-client";

async function CancellationsContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [
    canViewReports,
    canRequestCancellation,
    canManageDelivery,
    canApprove,
    canManageUsers,
    canManageRoles,
    canManageMenu,
  ] = await Promise.all([
    userHasPermission(user.id, "reports.view"),
    userHasPermission(user.id, "orders.cancel.request"),
    userHasPermission(user.id, "delivery.manage"),
    user.role.code === "DELIVERY"
      ? Promise.resolve(false)
      : userHasPermission(user.id, "orders.cancel.approve"),
    userHasPermission(user.id, "users.manage"),
    userHasPermission(user.id, "roles.manage"),
    userHasPermission(user.id, "settings.manage"),
  ]);
  const canViewCancellations =
    canViewReports ||
    canRequestCancellation ||
    (canManageDelivery && user.role.code === "DELIVERY");
  if (!canViewCancellations) redirect("/dashboard");
  const canViewEmployees =
    user.role.code === "OWNER" ||
    (await userHasPermission(user.id, "employee.view")) ||
    (await userHasPermission(user.id, "employees.manage"));

  const [report, eligibleOrders, pendingApprovals] = await Promise.all([
    getCancellationReport(user.id),
    canRequestCancellation ||
    (canManageDelivery && user.role.code === "DELIVERY")
      ? listCancellableOrders(user.id)
      : Promise.resolve([]),
    canApprove ? listPendingApprovals(user.id) : Promise.resolve([]),
  ]);

  return (
    <AppShell
      userName={user.fullName}
      role={user.role.name}
      canManageUsers={canManageUsers}
      canManageRoles={canManageRoles}
      canManageMenu={canManageMenu}
      canViewCancellations
      canViewEmployees={canViewEmployees}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <p className="text-sm text-slate-400">Orders & audit</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Order cancellations
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Har cancellation ka reason, approval aur permanent order history
            yahan record hoti hai.
          </p>
        </div>
        <CancellationsClient
          report={report}
          eligibleOrders={eligibleOrders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
          }))}
          pendingApprovals={pendingApprovals.map((approval) => ({
            id: approval.id,
            reason: approval.reason,
            createdAt: approval.createdAt.toISOString(),
            requestedBy: approval.requestedBy,
            order: approval.order,
          }))}
          canRequest={
            canRequestCancellation ||
            (canManageDelivery && user.role.code === "DELIVERY")
          }
          canApprove={canApprove}
        />
      </div>
    </AppShell>
  );
}

export default function CancellationsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen animate-pulse bg-[#0b1020]"
          aria-label="Loading cancellation reports"
        />
      }
    >
      <CancellationsContent />
    </Suspense>
  );
}
