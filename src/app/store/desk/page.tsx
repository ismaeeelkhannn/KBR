import { connection } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { StoreDesk } from "./store-desk";

export const instant = false;

export default async function StoreDeskPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!(await userHasPermission(user.id, "inventory.manage"))) {
    return <p className="p-6 text-slate-300">Ye panel storekeeper ke liye hai.</p>;
  }

  const branch = await db.branch.findFirst();
  if (!branch) {
    return <p className="p-6 text-slate-300">Koi branch nahi mili.</p>;
  }

  const items = await db.inventoryItem.findMany({
    orderBy: { code: "asc" },
    select: { id: true, name: true, unit: true },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-slate-100 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Store desk</h1>
        <p className="text-sm text-slate-400">Requests approve karein aur saman issue karein. Branch: {branch.name}</p>
      </header>
      <StoreDesk branchId={branch.id} items={items} />
    </main>
  );
}