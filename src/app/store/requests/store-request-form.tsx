"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; name: string; unit: string };
type Line = { inventoryItemId: string; requestedQty: string };
type Mine = { id: string; requisitionNo: string; status: string; purpose: string | null };

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500";

const emptyLine = (items: Item[]): Line => ({
  inventoryItemId: items[0]?.id ?? "",
  requestedQty: "",
});

export function StoreRequestForm({ branchId, items }: { branchId: string; items: Item[] }) {
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(items)]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/store/requisitions?branchId=${branchId}`);
    const data = await res.json();
    if (res.ok) setMine(data.requisitions as Mine[]);
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/store/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          purpose: purpose.trim(),
          lines: lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            requestedQty: Number(line.requestedQty),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Request nahi bheji ja saki" });
        return;
      }
      setMessage({ ok: true, text: `Request ${data.requisition.requisitionNo} bhej di gayi` });
      setPurpose("");
      setLines([emptyLine(items)]);
      void load();
    } catch {
      setMessage({ ok: false, text: "Network ka masla hai. Dobara try karein." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <input
          className={inputCls}
          placeholder="Kis kaam ke liye chahiye (jaise: aaj ka lunch prep)"
          value={purpose}
          maxLength={200}
          onChange={(e) => setPurpose(e.target.value)}
        />

        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
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
              value={line.requestedQty}
              onChange={(e) => updateLine(index, { requestedQty: e.target.value })}
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
            + Item add karein
          </button>
          <button
            type="submit"
            disabled={busy || items.length === 0 || !purpose.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Bhej rahe hain..." : "Request bhejein"}
          </button>
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-300"}`}>{message.text}</p>
        )}
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Meri requests</h2>
        {mine.length === 0 && <p className="text-sm text-slate-400">Abhi koi request nahi.</p>}
        {mine.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-800 p-3 text-sm">
            <div>
              <p className="font-mono text-slate-300">{r.requisitionNo}</p>
              <p className="text-slate-400">{r.purpose ?? "-"}</p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs">{r.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}