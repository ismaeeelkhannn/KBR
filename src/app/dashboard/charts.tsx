"use client";

import { formatPKR } from "@/modules/reports/dashboard-metrics";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "#0f1629",
  border: "1px solid #1f2a44",
  borderRadius: 12,
  color: "#e2e8f0",
  fontSize: 12,
};

const PALETTE = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#eab308",
  "#ef4444",
  "#14b8a6",
];

export function SalesAreaChart({
  data,
}: {
  data: { date: string; sales: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1f2a44"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="#5b6b8a"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#5b6b8a"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatPKR(Number(value))}
          />
          <Area
            type="monotone"
            dataKey="sales"
            name="Sales"
            stroke="#f97316"
            strokeWidth={2.5}
            fill="url(#salesFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesBarChart({
  data,
}: {
  data: { date: string; sales: number; expenses: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1f2a44"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="#5b6b8a"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#5b6b8a"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#ffffff08" }}
            contentStyle={tooltipStyle}
            formatter={(value) => formatPKR(Number(value))}
          />
          <Bar
            dataKey="sales"
            name="Sales"
            fill="#f97316"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="expenses"
            name="Kharche"
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreakdownDonut({
  data,
  money = false,
}: {
  data: { name: string; value: number }[];
  money?: boolean;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const formatValue = (value: number) =>
    money
      ? formatPKR(value)
      : value.toLocaleString("en-PK", { maximumFractionDigits: 0 });

  if (total === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        Is muddat mein abhi data nahi hai.
      </p>
    );
  }

  return (
    <div>
      <div className="relative h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="90%"
              paddingAngle={3}
              stroke="none"
            >
              {data.map((item, index) => (
                <Cell
                  key={item.name}
                  fill={PALETTE[index % PALETTE.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => formatValue(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{formatValue(total)}</p>
            <p className="text-xs text-slate-400">Total</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {data.map((item, index) => (
          <li
            key={item.name}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: PALETTE[index % PALETTE.length] }}
              />
              {item.name}
            </span>
            <span className="font-medium text-white">
              {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
