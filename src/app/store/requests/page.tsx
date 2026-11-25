import { connection } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/session";
import { StoreRequestForm } from "./store-request-form";

export const instant = false;

export default async function StoreRequestsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const branch = await db.branch.findFirst();
  if (!branch) {
    return <p className="p-6 text-slate-300">Koi branch nahi mili.</p>;
  }

  const items = await db.inventoryItem.findMany({
    orderBy: { code: "asc" },
    select: { id: true, name: true, unit: true },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 text-slate-100 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Saman ki request</h1>
        <p className="text-sm text-slate-400">Jo cheez chahiye wo likhein. Store se approve hone par issue hogi.</p>
      </header>
      <StoreRequestForm branchId={branch.id} items={items} />
    </main>
  );
}