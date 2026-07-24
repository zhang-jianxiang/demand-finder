"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendPoint } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
}

export default function TrendChart({ data, height = 300 }: TrendChartProps) {
  const chartData = data.map((p) => ({
    ...p,
    label: formatShortDate(p.date),
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">需求发现趋势</h3>
          <p className="text-xs text-slate-400 mt-0.5">最近 30 天每日新增需求数</p>
        </div>
        <span className="text-2xl">📈</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3377ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3377ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            interval="preserveStartEnd"
            tickCount={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#64748b", fontWeight: 600 }}
            formatter={(value: number) => [`${value} 条`, "需求"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#3377ff"
            strokeWidth={2}
            fill="url(#colorDemand)"
            dot={false}
            activeDot={{ r: 4, fill: "#3377ff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
