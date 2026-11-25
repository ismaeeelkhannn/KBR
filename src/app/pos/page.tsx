import { connection } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/session";
import { getPosCatalog } from "@/modules/pos/pos.service";
import { FinanceError } from "@/modules/finance/finance.service";
import { AppShell } from "@/components/app-shell/app-shell";
import { PosClient } from "./pos-client";

export default async function PosPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const branch = await db.branch.findFirst();
  const shell = (children: React.ReactNode) => (
    <AppShell userName={user.fullName} role={user.role.name}>
      {children}
    </AppShell>
  );

  if (!branch) return shell(<p className="text-slate-400">Branch nahi mili.</p>);

  let categories;
  try {
    categories = await getPosCatalog(user.id, branch.id);
  } catch (e) {
    const message = e instanceof FinanceError ? e.message : "Menu load nahi ho saka";
    return shell(<div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">{message}</div>);
  }

  return shell(
    categories.length === 0 ? (
      <p className="text-slate-400">Menu khali hai. Pehle items aur prices add karein.</p>
    ) : (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Point of Sale</h1>
          <p className="text-sm text-slate-400">{branch.name} · Order lein aur kitchen ko bhejein</p>
        </div>
        <PosClient branchId={branch.id} categories={categories} />
      </div>
    ),
  );
}

export const instant = false;
