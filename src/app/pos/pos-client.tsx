"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { findItemByCode } from "@/modules/pos/item-code";

export type PosVariant = { id: string; code: string; name: string; pricePaisa: number; isVerified: boolean };
export type PosProduct = { id: string; name: string; variants: PosVariant[] };
export type PosCategory = { id: string; name: string; products: PosProduct[] };

type CartLine = { variantId: string; name: string; pricePaisa: number; quantity: number; note: string };
type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

const rs = (p: number) => "Rs. " + (p / 100).toLocaleString("en-PK", { maximumFractionDigits: 0 });

export function PosClient({ branchId, categories }: { branchId: string; categories: PosCategory[] }) {
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const idemRef = useRef<string | null>(null);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q ? categories : categories.filter((c) => c.id === activeCat);
    return source.flatMap((c) => c.products).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [categories, activeCat, query]);

  const total = cart.reduce((s, l) => s + l.pricePaisa * l.quantity, 0);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  function resetKey() {
    idemRef.current = null;
  }

  function addToCart(v: PosVariant, productName: string) {
    resetKey();
    setMessage(null);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.variantId === v.id);
      if (i >= 0)
        return prev.map((l, idx) => (idx === i ? { ...l, quantity: Math.min(l.quantity + 1, 50) } : l));
      return [...prev, { variantId: v.id, name: `${productName} · ${v.name}`, pricePaisa: v.pricePaisa, quantity: 1, note: "" }];
    });
  }

  // Staff type the memorized item code; lookup covers every category, not just the active tab.
  function submitCode() {
    const flat = categories.flatMap((c) =>
      c.products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))),
    );
    const result = findItemByCode(flat, codeInput);
    if (result.status === "empty") return;
    if (result.status === "not_found") {
      setMessage({ kind: "err", text: `Code "${codeInput.trim()}" nahi mila` });
      return;
    }
    if (result.status === "ambiguous") {
      setMessage({ kind: "err", text: `Code "${codeInput.trim()}" ek se zyada items par hai; admin se check karein` });
      return;
    }
    const item = result.item;
    if (!item.isVerified) {
      setMessage({ kind: "err", text: `${item.name} ka price verify nahi hua; order nahi ho sakta` });
      return;
    }
    addToCart(item, item.productName);
    setCodeInput("");
  }

  function changeQty(variantId: string, delta: number) {
    resetKey();
    setCart((prev) =>
      prev
        .map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function changeNote(variantId: string, note: string) {
    resetKey();
    setCart((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, note: note.slice(0, 200) } : l)));
  }

  function clearCart() {
    resetKey();
    setCart([]);
    setMessage(null);
  }

  async function submit() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setMessage(null);
    if (!idemRef.current) idemRef.current = crypto.randomUUID();

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idemRef.current,
          branchId,
          orderType,
          items: cart.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            ...(l.note.trim() ? { note: l.note.trim() } : {}),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? `Order nahi bana (${res.status})` });
        return;
      }
      const num = data.order?.orderNumber ?? data.orderNumber;
      setMessage({ kind: "ok", text: num ? `Order ${num} kitchen ko bhej diya` : "Order kitchen ko bhej diya" });
      setCart([]);
      idemRef.current = null;
    } catch {
      setMessage({ kind: "err", text: "Network ka masla hai, dobara try karein" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Item search karein"
              className="w-full rounded-xl border border-[#1f2a44] bg-[#151d33] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCode();
              }
            }}
            aria-label="Item code"
            placeholder="Item code + Enter"
            autoComplete="off"
            className="w-44 rounded-xl border border-[#1f2a44] bg-[#151d33] px-4 py-2.5 text-sm uppercase text-white placeholder:normal-case placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {!query && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeCat === c.id
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "bg-[#151d33] text-slate-400 hover:text-white"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {visibleProducts.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">Is search se koi item nahi mila.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {visibleProducts.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-[#1f2a44] bg-[#151d33] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-orange-500/40"
              >
                <p className="font-semibold text-white">{p.name}</p>
                <div className="mt-3 grid gap-2">
                  {p.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => addToCart(v, p.name)}
                      className="flex items-center justify-between rounded-xl bg-[#0f1629] px-3 py-2.5 text-sm text-slate-300 transition hover:bg-orange-500/15 hover:text-orange-300 active:scale-[0.98]"
                    >
                      <span>{v.name}</span>
                      <span className="flex items-center gap-2 font-semibold text-white">
                        {!v.isVerified && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-label="Price verify nahi hui" />
                        )}
                        {rs(v.pricePaisa)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-[#1f2a44] bg-[#151d33] p-5 xl:sticky xl:top-28">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-orange-400" />
            <h2 className="font-semibold text-white">Cart</h2>
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-400">{count}</span>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">
              Khali karein
            </button>
          )}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-[#0f1629] p-1">
          {(["TAKEAWAY", "DINE_IN", "DELIVERY"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-lg py-1.5 text-xs font-medium transition ${
                orderType === t ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "DINE_IN" ? "Dine-in" : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
            </button>
          ))}
        </div>

        {cart.length === 0 ? (
          <div className="py-10 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm text-slate-500">Cart khali hai. Item par click karein.</p>
          </div>
        ) : (
          <ul className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {cart.map((l) => (
              <li key={l.variantId} className="rounded-xl bg-[#0f1629] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{l.name}</p>
                  <p className="text-sm font-semibold text-white">{rs(l.pricePaisa * l.quantity)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(l.variantId, -1)} className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10" aria-label="Kam karein">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-white">{l.quantity}</span>
                    <button onClick={() => changeQty(l.variantId, 1)} className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10" aria-label="Barhayein">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button onClick={() => changeQty(l.variantId, -l.quantity)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10" aria-label="Hataayein">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={l.note}
                  onChange={(e) => changeNote(l.variantId, e.target.value)}
                  placeholder="Note (jaise: mayo kam)"
                  className="mt-2 w-full rounded-lg border border-[#1f2a44] bg-[#151d33] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-3 border-t border-[#1f2a44] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Total</span>
            <span className="text-xl font-bold text-white">{rs(total)}</span>
          </div>

          {message && (
            <div
              className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                message.kind === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              }`}
            >
              {message.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={cart.length === 0 || submitting}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Bhej rahe hain..." : "Kitchen ko bhejein"}
          </button>
        </div>
      </aside>
    </div>
  );
}
