"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

type Report = {
  canViewAll: boolean;
  metrics: {
    todayCount: number;
    todayValuePaisa: number | null;
    weekCount: number;
    monthCount: number;
    monthlyRate: number | null;
  };
  reasons: { code: string; label: string; count: number }[];
  employees: { name: string; count: number }[];
  history: {
    id: string;
    orderNumber: string;
    customerName: string | null;
    items: {
      productNameSnapshot: string;
      variantNameSnapshot: string;
      quantity: number;
    }[];
    totalPaisa: number | null;
    reason: string;
    reasonCode: string | null;
    reasonLabel: string;
    cancelledBy: string;
    approvedBy: string;
    cancelledAt: string;
  }[];
};

type EligibleOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: string;
  totalPaisa: number | null;
  createdAt: string;
  items: {
    productNameSnapshot: string;
    variantNameSnapshot: string;
    quantity: number;
  }[];
};

type PendingApproval = {
  id: string;
  reason: string;
  createdAt: string;
  requestedBy: { fullName: string; role: { name: string } };
  order: {
    orderNumber: string;
    status: string;
    totalPaisa: number;
    customerName: string | null;
  };
};

const REASONS = [
  ["CUSTOMER_CHANGED_MIND", "Customer changed mind"],
  ["WRONG_ORDER", "Wrong order placed"],
  ["CUSTOMER_NOT_RESPONDING", "Customer not responding"],
  ["PAYMENT_ISSUE", "Payment issue"],
  ["DELIVERY_PROBLEM", "Delivery problem"],
  ["PREPARATION_DELAY", "Food preparation delay"],
  ["OUT_OF_STOCK", "Out of stock"],
  ["OTHER", "Other"],
] as const;

const money = (paisa: number) =>
  `Rs. ${(paisa / 100).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

function localDate(value: string) {
  return new Date(value).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function CancellationsClient({
  report,
  eligibleOrders,
  pendingApprovals,
  canRequest,
  canApprove,
}: {
  report: Report;
  eligibleOrders: EligibleOrder[];
  pendingApprovals: PendingApproval[];
  canRequest: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const selectedOrder = eligibleOrders.find(
    (order) => order.id === selectedOrderId,
  );

  async function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder || !reasonCode || busy) return;
    setBusy("request");
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(selectedOrder.id)}/cancel-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode,
            ...(reasonCode === "OTHER" ? { customReason } : {}),
          }),
        },
      );
      const data: unknown = await response.json().catch(() => null);
      const result = isRecord(data) ? data : null;
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : `Request nahi hui (${response.status})`,
        );
      }
      setSelectedOrderId("");
      setReasonCode("");
      setCustomReason("");
      setFeedback({ ok: true, text: "Cancel request approval ke liye bhej di." });
      router.refresh();
    } catch (error) {
      setFeedback({
        ok: false,
        text:
          error instanceof Error ? error.message : "Request complete nahi hui.",
      });
    } finally {
      setBusy("");
    }
  }

  async function decide(approvalId: string, decision: "APPROVED" | "REJECTED") {
    if (busy) return;
    setBusy(approvalId);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/approvals/${encodeURIComponent(approvalId)}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            ...(decisionNote.trim() ? { note: decisionNote.trim() } : {}),
          }),
        },
      );
      const data: unknown = await response.json().catch(() => null);
      const result = isRecord(data) ? data : null;
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : `Decision save nahi hua (${response.status})`,
        );
      }
      setDecisionNote("");
      setFeedback({
        ok: true,
        text:
          decision === "APPROVED"
            ? "Order cancel kar diya gaya."
            : "Cancel request reject kar di gayi.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        ok: false,
        text:
          error instanceof Error ? error.message : "Decision save nahi hua.",
      });
    } finally {
      setBusy("");
    }
  }

  const statCards = [
    {
      label: "Cancelled today",
      value: report.metrics.todayCount.toLocaleString("en-PK"),
      detail:
        report.metrics.todayValuePaisa === null
          ? "Order value restricted"
          : money(report.metrics.todayValuePaisa),
      icon: Ban,
      color: "text-red-300 bg-red-500/10",
    },
    {
      label: "This week",
      value: report.metrics.weekCount.toLocaleString("en-PK"),
      detail: "Approved cancellations",
      icon: Clock3,
      color: "text-amber-300 bg-amber-500/10",
    },
    {
      label: "This month",
      value: report.metrics.monthCount.toLocaleString("en-PK"),
      detail: report.canViewAll ? "All accessible branches" : "Your requests",
      icon: DollarSign,
      color: "text-orange-300 bg-orange-500/10",
    },
    {
      label: "Monthly cancellation rate",
      value:
        report.metrics.monthlyRate === null
          ? "—"
          : `${report.metrics.monthlyRate}%`,
      detail: report.canViewAll ? "Cancellations / orders" : "Admin report only",
      icon: ShieldCheck,
      color: "text-violet-300 bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            feedback.ok
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
              : "border-red-500/20 bg-red-500/5 text-red-300"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {feedback.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, detail, icon: Icon, color }) => (
          <section
            key={label}
            className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{value}</p>
              </div>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {canRequest && (
          <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-white">Request cancellation</h2>
              <p className="mt-1 text-sm text-slate-400">
                Eligible order select karke reason zaroor choose karein.
              </p>
            </div>
            {eligibleOrders.length === 0 ? (
              <p className="rounded-xl bg-[#151d33] p-4 text-sm text-slate-400">
                Is waqt koi eligible order nahi hai. Existing order history neeche
                available hai.
              </p>
            ) : (
              <div className="space-y-2">
                {eligibleOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-xl bg-[#151d33] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        #{order.orderNumber}
                        {order.customerName ? ` · ${order.customerName}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                        items · {order.status.replaceAll("_", " ")}
                        {order.totalPaisa !== null
                          ? ` · ${money(order.totalPaisa)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderId(order.id);
                        setReasonCode("");
                        setCustomReason("");
                      }}
                      className="shrink-0 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
                    >
                      Cancel order
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {canApprove && (
          <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-white">Approval queue</h2>
              <p className="mt-1 text-sm text-slate-400">
                Request karne wala khud approve nahi kar sakta.
              </p>
            </div>
            {pendingApprovals.length === 0 ? (
              <p className="rounded-xl bg-[#151d33] p-4 text-sm text-slate-400">
                Koi pending cancellation approval nahi.
              </p>
            ) : (
              <>
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs text-slate-400">
                    Decision note (optional)
                  </span>
                  <input
                    value={decisionNote}
                    onChange={(event) =>
                      setDecisionNote(event.target.value.slice(0, 200))
                    }
                    maxLength={200}
                    className="w-full rounded-lg border border-[#26334f] bg-[#151d33] px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </label>
                <div className="space-y-3">
                  {pendingApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="rounded-xl border border-[#26334f] bg-[#151d33] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-white">
                            #{approval.order.orderNumber}
                            {approval.order.customerName
                              ? ` · ${approval.order.customerName}`
                              : ""}
                          </p>
                          <p className="mt-1 text-sm text-slate-300">
                            {approval.reason}
                            {approval.order.totalPaisa !== null
                              ? ` · ${money(approval.order.totalPaisa)}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {approval.requestedBy.fullName} (
                            {approval.requestedBy.role.name}) ·{" "}
                            {localDate(approval.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => void decide(approval.id, "REJECTED")}
                            disabled={Boolean(busy)}
                            className="rounded-lg border border-[#34415b] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => void decide(approval.id, "APPROVED")}
                            disabled={Boolean(busy)}
                            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {busy === approval.id ? "Saving..." : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
          <h2 className="font-semibold text-white">Common reasons this month</h2>
          {report.reasons.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Abhi koi cancellation record nahi.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {report.reasons.map((reason) => {
                const maxCount = report.reasons[0]?.count ?? 1;
                return (
                  <div key={reason.code}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="text-slate-300">{reason.label}</span>
                      <span className="text-slate-400">{reason.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#1a2540]">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${(reason.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
          <h2 className="font-semibold text-white">Cancellations by employee</h2>
          {report.employees.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Abhi koi cancellation record nahi.</p>
          ) : (
            <div className="mt-4 divide-y divide-[#1b2540]">
              {report.employees.map((employee) => (
                <div
                  key={`${employee.name}-${employee.count}`}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="text-slate-300">{employee.name}</span>
                  <span className="rounded-full bg-[#1a2540] px-2.5 py-1 text-xs text-slate-300">
                    {employee.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-[#1b2540] bg-[#0f1629] p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-semibold text-white">Cancelled orders history</h2>
            <p className="mt-1 text-sm text-slate-400">
              {report.canViewAll
                ? "Latest 100 cancelled orders across your accessible branches."
                : "Aap ki apni cancellation requests."}
            </p>
          </div>
          <span className="text-xs text-slate-500">{report.history.length} records</span>
        </div>
        {report.history.length === 0 ? (
          <p className="rounded-xl bg-[#151d33] p-5 text-center text-sm text-slate-400">
            Abhi tak koi approved cancellation record nahi.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#26334f] text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Order / Customer</th>
                  <th className="pb-3 pr-4 font-medium">Items</th>
                  <th className="pb-3 pr-4 font-medium">Reason</th>
                  <th className="pb-3 pr-4 font-medium">Cancelled by</th>
                  <th className="pb-3 pr-4 font-medium">Approved by</th>
                  <th className="pb-3 pr-4 font-medium">Date & time</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.history.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#1b2540]/70 align-top last:border-0"
                  >
                    <td className="py-4 pr-4">
                      <p className="font-medium text-white">#{item.orderNumber}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.customerName || "Customer not recorded"}
                      </p>
                    </td>
                    <td className="max-w-64 py-4 pr-4 text-xs text-slate-300">
                      {item.items.map((orderItem) => (
                        <p key={`${orderItem.productNameSnapshot}-${orderItem.variantNameSnapshot}`}>
                          {orderItem.productNameSnapshot}{" "}
                          {orderItem.variantNameSnapshot} × {orderItem.quantity}
                        </p>
                      ))}
                    </td>
                    <td className="py-4 pr-4">
                      <p className="text-slate-200">{item.reasonLabel}</p>
                      <p className="mt-1 max-w-56 text-xs text-slate-500">
                        {item.reason}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-slate-300">{item.cancelledBy}</td>
                    <td className="py-4 pr-4 text-slate-300">{item.approvedBy}</td>
                    <td className="py-4 pr-4 text-xs text-slate-400">
                      {localDate(item.cancelledAt)}
                    </td>
                    <td className="py-4 text-right font-medium text-white">
                      {item.totalPaisa === null ? "—" : money(item.totalPaisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancellation-dialog-title"
            onSubmit={(event) => void submitCancellation(event)}
            className="w-full max-w-lg rounded-2xl border border-[#26334f] bg-[#0f1629] p-6 shadow-2xl"
          >
            <h2
              id="cancellation-dialog-title"
              className="text-lg font-semibold text-white"
            >
              Cancel #{selectedOrder.orderNumber}?
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Request approval ke baad hi order ka status Cancelled hoga.
            </p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm text-slate-300">
                Cancellation reason <span className="text-red-400">*</span>
              </span>
              <select
                required
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                className="w-full rounded-xl border border-[#26334f] bg-[#151d33] px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="">Reason select karein</option>
                {REASONS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {reasonCode === "OTHER" && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm text-slate-300">
                  Custom reason <span className="text-red-400">*</span>
                </span>
                <textarea
                  required
                  minLength={3}
                  maxLength={193}
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-[#26334f] bg-[#151d33] px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrderId("")}
                disabled={Boolean(busy)}
                className="rounded-xl border border-[#34415b] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={Boolean(busy) || !reasonCode}
                className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "request" ? "Sending..." : "Send request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
