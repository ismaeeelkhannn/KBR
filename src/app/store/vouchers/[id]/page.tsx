import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { getCurrentUser } from "@/modules/auth/session";

export const instant = false;

export default async function StoreVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const voucher = await db.storeIssueVoucher.findUnique({
    where: { id },
    include: { requisition: { include: { lines: true } } },
  });
  if (!voucher) notFound();

  const canView =
    voucher.receivedById === user.id ||
    (await userHasPermission(user.id, "inventory.manage"));
  if (!canView) {
    return <p className="p-6 text-slate-300">Is voucher ko dekhne ki ijazat nahi.</p>;
  }

  const [branch, receiver, items] = await Promise.all([
    db.branch.findUnique({ where: { id: voucher.branchId }, select: { name: true } }),
    db.employee.findFirst({
      where: { userId: voucher.receivedById },
      select: { fullName: true, employeeCode: true },
    }),
    db.inventoryItem.findMany({
      where: { id: { in: voucher.requisition.lines.map((l) => l.inventoryItemId) } },
      select: { id: true, name: true, unit: true },
    }),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const rs = (paisa: number) => `Rs ${(paisa / 100).toFixed(2)}`;

  return (
    <main className="mx-auto max-w-2xl space-y-6 bg-slate-950 p-6 text-slate-100 print:bg-white print:text-black">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-4 print:border-slate-300">
        <div>
          <h1 className="text-2xl font-semibold">Store Issue Voucher</h1>
          <p className="text-sm text-slate-400 print:text-slate-600">{branch?.name ?? ""}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono">{voucher.voucherNo}</p>
          <p className="text-slate-400 print:text-slate-600">
            {new Date(voucher.createdAt).toLocaleString("en-PK")}
          </p>
        </div>
      </header>

      <section className="grid gap-2 text-sm md:grid-cols-2">
        <p>Requisition: <span className="font-mono">{voucher.requisition.requisitionNo}</span></p>
        <p>Purpose: {voucher.requisition.purpose ?? "-"}</p>
        <p>
          Liya (receiver): {receiver ? `${receiver.fullName} (${receiver.employeeCode})` : "-"}
        </p>
        <p>Verify: {voucher.verifyMethod}</p>
      </section>

      <table className="w-full text-sm">
        <thead className="border-b border-slate-700 text-left text-slate-400 print:text-slate-600">
          <tr>
            <th className="py-2">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {voucher.requisition.lines
            .filter((line) => line.issuedQty > 0)
            .map((line) => {
              const item = itemById.get(line.inventoryItemId);
              return (
                <tr key={line.id} className="border-b border-slate-800 print:border-slate-200">
                  <td className="py-2">{item ? `${item.name} (${item.unit})` : line.inventoryItemId}</td>
                  <td className="text-right tabular-nums">{line.issuedQty}</td>
                  <td className="text-right tabular-nums">{rs(line.unitCostPaisa)}</td>
                  <td className="text-right tabular-nums">{rs(line.lineTotalPaisa)}</td>
                </tr>
              );
            })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="py-3 text-right font-semibold">Total</td>
            <td className="py-3 text-right font-semibold tabular-nums">{rs(voucher.totalPaisa)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-8 pt-10 text-sm print:text-black">
        <div className="border-t border-slate-600 pt-2">Storekeeper ke dastakhat</div>
        <div className="border-t border-slate-600 pt-2">Receiver ke dastakhat</div>
      </div>

      <p className="text-xs text-slate-500 print:hidden">Print ke liye Ctrl+P dabayein.</p>
    </main>
  );
}