"use client";

import { useState } from "react";

type Item = { id: string; name: string; unit: string };
type Line = { inventoryItemId: string; quantityBase: string; totalRupees: string };

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500";

const emptyLine = (items: Item[]): Line => ({
  inventoryItemId: items[0]?.id ?? "",
  quantityBase: "",
  totalRupees: "",
});

export function StorePurchaseForm({ branchId, items }: { branchId: string; items: Item[] }) {
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(items)]);
  // Same key tab tak rahe jab tak save na ho, taake network retry se double entry na ho
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          branchId,
          supplierName: supplierName.trim() || undefined,
          invoiceNo: invoiceNo.trim() || undefined,
          lines: lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantityBase: Number(line.quantityBase),
            lineTotalPaisa: Math.round(Number(line.totalRupees) * 100),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Save nahi hua" });
        return;
      }
      setMessage({
        ok: true,
        text: data.replayed ? "Ye entry pehle se save thi" : "Saman store mein add ho gaya",
      });
      setSupplierName("");
      setInvoiceNo("");
      setLines([emptyLine(items)]);
      setIdempotencyKey(crypto.randomUUID());
    } catch {
      setMessage({
        ok: false,
        text: "Network ka masla hai. Dobara try karein, same entry dobara save nahi hogi.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className={inputCls}
          placeholder="Supplier ka naam (optional)"
          value={supplierName}
          maxLength={120}
          onChange={(e) => setSupplierName(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Invoice no. (optional)"
          value={invoiceNo}
          maxLength={60}
          onChange={(e) => setInvoiceNo(e.target.value)}
        />
      </div>

      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
          <select
            className={inputCls}
            value={line.inventoryItemId}
            onChange={(e) => updateLine(index, { inventoryItemId: e.target.value })}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            type="number"
            min={1}
            step={1}
            placeholder="Quantity"
            value={line.quantityBase}
            onChange={(e) => updateLine(index, { quantityBase: e.target.value })}
          />
          <input
            className={inputCls}
            type="number"
            min={0}
            step="0.01"
            placeholder="Total (Rs)"
            value={line.totalRupees}
            onChange={(e) => updateLine(index, { totalRupees: e.target.value })}
          />
          <button
            type="button"
            disabled={lines.length === 1}
            onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
            className="rounded-lg border border-slate-700 px-3 text-sm text-slate-300 disabled:opacity-40"
          >
            Hatao
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine(items)])}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
        >
          + Line add karein
        </button>
        <button
          type="submit"
          disabled={busy || items.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Save ho raha hai..." : "Store mein add karein"}
        </button>
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-300"}`}>{message.text}</p>
      )}
    </form>
  );
}
