const tones = {
  success: "bg-green-50 text-green-700 ring-green-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  warning: "bg-orange-50 text-orange-700 ring-orange-600/20",
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
