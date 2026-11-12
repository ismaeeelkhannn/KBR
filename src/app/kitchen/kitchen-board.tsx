"use client";

import { useCallback, useEffect, useState } from "react";

type KitchenStatus = "CONFIRMED" | "PREPARING" | "READY";

type KitchenItem = {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  quantity: number;
  note: string | null;
};

type KitchenOrder = {
  id: string;
  orderNumber: string;
  status: KitchenStatus;
  createdAt: string;
  items: KitchenItem[];
};

type StatusStep = {
  to: "PREPARING" | "READY" | "SERVED";
  label: string;
};

const NEXT_STEP: Partial<Record<KitchenStatus, StatusStep>> = {
  CONFIRMED: { to: "PREPARING", label: "Shuru karein" },
  PREPARING: { to: "READY", label: "Ready hai" },
  READY: { to: "SERVED", label: "Serve ho gaya" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isKitchenItem(value: unknown): value is KitchenItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.productNameSnapshot === "string" &&
    typeof value.variantNameSnapshot === "string" &&
    typeof value.quantity === "number" &&
    (value.note === null || typeof value.note === "string")
  );
}

function isKitchenOrder(value: unknown): value is KitchenOrder {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.orderNumber === "string" &&
    (value.status === "CONFIRMED" ||
      value.status === "PREPARING" ||
      value.status === "READY") &&
    typeof value.createdAt === "string" &&
    Array.isArray(value.items) &&
    value.items.every(isKitchenItem)
  );
}

function getApiError(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : fallback;
}

export function KitchenBoard() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen/orders", {
        cache: "no-store",
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(getApiError(data, "Orders load nahi hue"));
        return;
      }

      const rawOrders = isRecord(data) ? data.orders : null;
      if (
        !Array.isArray(rawOrders) ||
        !rawOrders.every(isKitchenOrder)
      ) {
        setError("Orders ka response ghalat hai");
        return;
      }

      setError(null);
      setOrders(rawOrders);
    } catch {
      setError("Orders load nahi hue");
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 5000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(timer);
    };
  }, [load]);

  async function advance(order: KitchenOrder) {
    const step = NEXT_STEP[order.status];
    if (!step) return;

    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: step.to }),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setError(getApiError(data, "Status change nahi hua"));
        return;
      }

      setError(null);
      await load();
    } catch {
      setError("Status change nahi hua");
    }
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {orders.length === 0 && (
        <p className="text-gray-500">Abhi koi active order nahi hai.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => {
          const step = NEXT_STEP[order.status];

          return (
            <div key={order.id} className="rounded border p-4">
              <div className="mb-2 flex items-center justify-between">
                <strong>{order.orderNumber}</strong>
                <span className="text-xs text-gray-600">{order.status}</span>
              </div>

              <ul className="mb-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.productNameSnapshot} (
                    {item.variantNameSnapshot})
                    {item.note && (
                      <span className="text-gray-500"> - {item.note}</span>
                    )}
                  </li>
                ))}
              </ul>

              {step && (
                <button
                  type="button"
                  onClick={() => void advance(order)}
                  className="w-full rounded bg-black p-2 text-white"
                >
                  {step.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
