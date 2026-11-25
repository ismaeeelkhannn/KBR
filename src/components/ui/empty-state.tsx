import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  tone = "neutral",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "danger";
}) {
  const color =
    tone === "danger"
      ? "bg-red-50 text-red-600"
      : "bg-slate-100 text-slate-500";

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className={`rounded-2xl p-3 ${color}`}>
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}
