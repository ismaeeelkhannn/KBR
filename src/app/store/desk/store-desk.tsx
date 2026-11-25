"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; name: string; unit: string };
type Line = {
  id: string;
  inventoryItemId: string;
  requestedQty: number;
  approvedQty: number;
  issuedQty: number;
};
type Requisition = {
  id: string;
  requisitionNo: string;
  status: string;
  purpose: string | null;
  lines: Line[];
};

const inputCls =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500";

export function StoreDesk({ branchId, items }: { branchId: string; items: Item[] }) {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receiver, setReceiver] = useState<Record<string, { code: string; pin: string }>>({});

  const itemById = new Map(items.map((item) => [item.id, item]));

  const load = useCallback(async () => {
    const res = await fetch(`/api/store/requisitions?branchId=${branchId}`);
    const data = await res.json();
    if (res.ok) setRows(data.requisitions as Requisition[]);
    else setMessage({ ok: false, text: data.error ?? "List load nahi hui" });
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    setMessage(null);
    const { ok, data } = await post(`/api/store/requisitions/${id}/decide`, { decision });
    setMessage({
      ok,
      text: ok
        ? decision === "APPROVE"
          ? "Requisition approve ho gayi"
          : "Requisition reject ho gayi"
        : data.error ?? "Masla aaya",
    });
    setBusyId(null);
    void load();
  }

  async function issue(id: string) {
    const current = receiver[id] ?? { code: "", pin: "" };
    setBusyId(id);
    setMessage(null);
    const { ok, data } = await post(`/api/store/requisitions/${id}/issue`, {
      receiverEmployeeCode: current.code.trim(),
      pin: current.pin,
    });
    if (ok) {
      setMessage({
        ok: true,
        text: `Voucher ${data.voucher.voucherNo} ban gaya. Total Rs ${(data.voucher.totalPaisa / 100).toFixed(2)}`,
      });
      setReceiver((prev) => ({ ...prev, [id]: { code: "", pin: "" } }));
    } else {
      setMessage({ ok: false, text: data.error ?? "Issue nahi hua" });
    }
    setBusyId(null);
    void load();
  }

  function setReceiverField(id: string, field: "code" | "pin", value: string) {
    setReceiver((prev) => {
      const current = prev[id] ?? { code: "", pin: "" };
      return { ...prev, [id]: { ...current, [field]: value } };
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-300"}`}>{message.text}</p>
      )}
      {rows.length === 0 && <p className="text-sm text-slate-400">Abhi koi requisition nahi hai.</p>}

      {rows.map((req) => {
        const current = receiver[req.id] ?? { code: "", pin: "" };
        const canDecide = req.status === "REQUESTED";
        const canIssue = req.status === "APPROVED" || req.status === "PARTIAL";

        return (
          <div key={req.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm text-slate-300">{req.requisitionNo}</p>
                <p className="text-sm text-slate-400">{req.purpose ?? "-"}</p>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs">{req.status}</span>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="text-right">Mangi</th>
                  <th className="text-right">Approve</th>
                  <th className="text-right">Issue</th>
                </tr>
              </thead>
              <tbody>
                {req.lines.map((line) => {
                  const item = itemById.get(line.inventoryItemId);
                  return (
                    <tr key={line.id} className="border-t border-slate-800">
                      <td className="py-1">{item ? `${item.name} (${item.unit})` : line.inventoryItemId}</td>
                      <td className="text-right">{line.requestedQty}</td>
                      <td className="text-right">{line.approvedQty}</td>
                      <td className="text-right">{line.issuedQty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {canDecide && (
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busyId === req.id}
                  onClick={() => decide(req.id, "APPROVE")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Approve (poori quantity)
                </button>
                <button
                  disabled={busyId === req.id}
                  onClick={() => decide(req.id, "REJECT")}
                  className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-300 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}

            {canIssue && (
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className={inputCls}
                  placeholder="Receiver ka employee code"
                  value={current.code}
                  onChange={(e) => setReceiverField(req.id, "code", e.target.value)}
                />
                <input
                  className={inputCls}
                  type="password"
                  inputMode="numeric"
                  placeholder="Receiver ka PIN"
                  value={current.pin}
                  onChange={(e) => setReceiverField(req.id, "pin", e.target.value)}
                />
                <button
                  disabled={busyId === req.id || !current.code || !current.pin}
                  onClick={() => issue(req.id)}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Issue karein
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}