import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/session";
import { getStockBalances } from "@/modules/inventory/inventory.service";
import { StorePurchaseForm } from "./store-purchase-form";

export default async function StorePage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const branch = await db.branch.findFirst();
  if (!branch) {
    return <p className="p-6 text-slate-300">Koi branch nahi mili.</p>;
  }

  let stock: Awaited<ReturnType<typeof getStockBalances>> = [];
  let error: string | null = null;
  try {
    stock = await getStockBalances(user.id, branch.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Stock load nahi hua";
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 text-slate-100 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Store</h1>
        <p className="text-sm text-slate-400">Branch: {branch.name}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saman aur balance</h2>
        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Naam</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3">Unit</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <tr key={row.code} className="border-t border-slate-800">
                    <td className="p-3 font-mono text-slate-400">{row.code}</td>
                    <td className="p-3">{row.name}</td>
                    <td className={`p-3 text-right tabular-nums ${row.balance <= 0 ? "text-red-400" : ""}`}>
                      {row.balance.toLocaleString("en-PK")}
                    </td>
                    <td className="p-3 text-slate-400">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!error && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Saman store mein daalein</h2>
          <StorePurchaseForm
            branchId={branch.id}
            items={stock.map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
          />
        </section>
      )}
    </main>
  );
}

export const instant = false;
