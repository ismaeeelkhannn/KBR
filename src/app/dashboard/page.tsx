import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Ban,
  ClipboardList,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell/app-shell";
import { BreakdownDonut, SalesAreaChart, SalesBarChart } from "./charts";
import { getCurrentUser } from "@/modules/auth/session";
import { userHasPermission } from "@/modules/access-control/permissions";
import { getDailyReport } from "@/modules/reports/daily-report.service";
import {
  businessDay,
  formatPKR,
  netIncome,
  pctChange,
} from "@/modules/reports/dashboard-metrics";

export const metadata: Metadata = {
  title: "Dashboard | Khan Burger & Restaurant",
};

function pkr(paisa: number) {
  return formatPKR(paisa / 100);
}

function dateOffset(date: string, offset: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function chartDate(date: string) {
  return new Date(`${date}T00:00:00+05:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Karachi",
  });
}

function Card({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  title,
  value,
  change,
  invertChange = false,
  icon: Icon,
  tint,
}: {
  title: string;
  value: string;
  change: number | "new" | null;
  invertChange?: boolean;
  icon: typeof TrendingUp;
  tint: string;
}) {
  const up = change === "new" || (typeof change === "number" && change >= 0);
  const favorable = change !== null && (invertChange ? !up : up);
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">
            {value}
          </p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs">
        <span
          className={`inline-flex items-center gap-0.5 font-semibold ${
            change === null
              ? "text-slate-400"
              : favorable
                ? "text-emerald-400"
                : "text-red-400"
          }`}
        >
          {change === null ? (
            "—"
          ) : (
            <>
              <Arrow className="h-4 w-4" />
              {change === "new" ? "New" : `${Math.abs(change).toFixed(1)}%`}
            </>
          )}
        </span>
        <span className="text-slate-500">vs. previous day</span>
      </div>
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: "bg-slate-500/15 text-slate-300",
  PREPARING: "bg-amber-500/15 text-amber-300",
  READY: "bg-blue-500/15 text-blue-300",
  SERVED: "bg-violet-500/15 text-violet-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
  CANCELLED: "bg-red-500/15 text-red-300",
};

async function loadDashboardData(
  userId: string,
  branchId: string,
  todayDate: string,
  dates: string[],
) {
  const reports = await Promise.all(
    dates.map((date) => getDailyReport(userId, branchId, date)),
  );
  const todayRange = {
    gte: new Date(`${todayDate}T00:00:00+05:00`),
    lt: new Date(new Date(`${todayDate}T00:00:00+05:00`).getTime() + 86400000),
  };
  const [paymentGroups, expenseGroups, recentOrders] = await Promise.all([
    db.payment.groupBy({
      by: ["method"],
      where: {
        status: "COMPLETED",
        createdAt: todayRange,
        order: { branchId },
      },
      _sum: { amountPaisa: true },
    }),
    db.expense.groupBy({
      by: ["category"],
      where: { branchId, expenseDate: todayRange },
      _sum: { amountPaisa: true },
    }),
    db.order.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaisa: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    }),
  ]);
  return { reports, paymentGroups, expenseGroups, recentOrders };
}

async function DashboardContent() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  const [canManageUsers, canManageRoles, canManageMenu, canViewCancellations, canViewEmployees] =
    await Promise.all([
    userHasPermission(user.id, "users.manage"),
    userHasPermission(user.id, "roles.manage"),
    userHasPermission(user.id, "settings.manage"),
    userHasPermission(user.id, "reports.view"),
    userHasPermission(user.id, "employee.view"),
  ]);

  const branches = await db.branch.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(user.role.name === "OWNER"
        ? {}
        : { userAccess: { some: { userId: user.id } } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const branch = branches[0];

  if (!branch) {
    return (
      <AppShell
        userName={user.fullName}
        role={user.role.name}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canManageMenu={canManageMenu}
        canViewCancellations={canViewCancellations}
        canViewEmployees={canViewEmployees || user.role.code === "OWNER"}
      >
        <div className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-8 text-slate-300">
          Aap ke account ke liye koi active branch available nahi hai.
        </div>
      </AppShell>
    );
  }

  const todayDate = businessDay(new Date(), "Asia/Karachi");
  const dates = Array.from({ length: 7 }, (_, index) =>
    dateOffset(todayDate, index - 6),
  );

  let dashboardData: Awaited<ReturnType<typeof loadDashboardData>> | null = null;
  try {
    dashboardData = await loadDashboardData(
      user.id,
      branch.id,
      todayDate,
      dates,
    );
  } catch (error) {
    console.error("Dashboard report error:", error);
  }

  if (!dashboardData) {
    return (
      <AppShell
        userName={user.fullName}
        role={user.role.name}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canManageMenu={canManageMenu}
        canViewCancellations={canViewCancellations}
        canViewEmployees={canViewEmployees || user.role.code === "OWNER"}
      >
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
          Dashboard report load nahi ho saka. Reports access aur branch
          permissions check karein.
        </div>
      </AppShell>
    );
  }

  const { reports, paymentGroups, expenseGroups, recentOrders } = dashboardData;
  const today = reports[reports.length - 1];
  const yesterday = reports[reports.length - 2];
  const chartData = reports.map((report) => ({
    date: chartDate(report.date),
    sales: report.salesPaisa / 100,
    expenses: report.expensesPaisa / 100,
  }));
  const sales = today.salesPaisa;
  const expenses = today.expensesPaisa;
  const net = netIncome({
    sales: today.salesPaisa,
    expenses: today.expensesPaisa,
  });
  const orders = Object.values(today.orders).reduce(
    (sum, count) => sum + count,
    0,
  );
  const previousOrders = Object.values(yesterday.orders).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
      <AppShell
        userName={user.fullName}
        role={user.role.name}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canManageMenu={canManageMenu}
        canViewCancellations={canViewCancellations}
        canViewEmployees={canViewEmployees || user.role.code === "OWNER"}
      >
        <div className="mx-auto max-w-[1600px] space-y-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-slate-400">
                {new Date().toLocaleDateString("en-PK", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Karachi",
                })}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Aaj ki business performance — {branch.name}
              </p>
            </div>
            <span className="w-fit rounded-full border border-[#27334e] bg-[#121c32] px-4 py-2 text-sm text-slate-300">
              {branch.name}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Aaj ki sales"
              value={pkr(sales)}
              change={pctChange(sales, yesterday.salesPaisa)}
              icon={Banknote}
              tint="bg-orange-500/15 text-orange-400"
            />
            <StatCard
              title="Aaj ke kharche"
              value={pkr(expenses)}
              change={pctChange(expenses, yesterday.expensesPaisa)}
              invertChange
              icon={Wallet}
              tint="bg-blue-500/15 text-blue-400"
            />
            <StatCard
              title="Net income"
              value={pkr(net)}
              change={pctChange(net, yesterday.netPaisa)}
              icon={TrendingUp}
              tint="bg-emerald-500/15 text-emerald-400"
            />
            <StatCard
              title="Aaj ke orders"
              value={orders.toLocaleString("en-PK")}
              change={pctChange(orders, previousOrders)}
              icon={ShoppingCart}
              tint="bg-violet-500/15 text-violet-400"
            />
          </div>

          <Link
            href="/admin/cancellations"
            className="flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 transition hover:border-red-500/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-500/15 text-red-400">
                <Ban className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-white">Cancelled today</p>
                <p className="text-sm text-slate-400">
                  Cancelled orders ka audit trail aur reports
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-bold text-red-300">
                {today.cancellations.count}
              </p>
              <p className="text-sm text-slate-400">
                {pkr(today.cancellations.totalPaisa)} order value
              </p>
            </div>
          </Link>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card
              title="Sales overview"
              action={
                <span className="rounded-lg bg-[#17213a] px-3 py-1.5 text-xs text-slate-300">
                  Last 7 days
                </span>
              }
              className="xl:col-span-2"
            >
              <SalesAreaChart data={chartData} />
            </Card>
            <Card title="Sales by payment method">
              <BreakdownDonut
                data={paymentGroups.map((item) => ({
                  name: item.method.replaceAll("_", " "),
                  value: (item._sum.amountPaisa ?? 0) / 100,
                }))}
                money
              />
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Sales vs. expenses" className="xl:col-span-2">
              <SalesBarChart data={chartData} />
            </Card>
            <Card title="Expenses by category">
              <BreakdownDonut
                data={expenseGroups.map((item) => ({
                  name: item.category,
                  value: (item._sum.amountPaisa ?? 0) / 100,
                }))}
                money
              />
            </Card>
          </div>

          <Card
            title="Recent orders"
            action={
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <ClipboardList className="h-4 w-4" />
                Latest 6
              </span>
            }
          >
            {recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Abhi tak koi order nahi hai.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#1b2540] text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-3 font-medium">Order</th>
                      <th className="pb-3 font-medium">Waqt</th>
                      <th className="pb-3 font-medium">Items</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-[#1b2540]/70 last:border-0"
                      >
                        <td className="py-4 font-medium text-white">
                          #{order.orderNumber}
                        </td>
                        <td className="py-4 text-slate-400">
                          {order.createdAt.toLocaleTimeString("en-PK", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Karachi",
                          })}
                        </td>
                        <td className="py-4 text-slate-300">
                          {order.items.reduce(
                            (sum, item) => sum + item.quantity,
                            0,
                          )}
                        </td>
                        <td className="py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              STATUS_TONE[order.status] ??
                              "bg-slate-500/15 text-slate-300"
                            }`}
                          >
                            {order.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="py-4 text-right font-medium text-white">
                          {pkr(order.totalPaisa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animate-pulse bg-[#0b1020]" aria-label="Loading dashboard" />
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
