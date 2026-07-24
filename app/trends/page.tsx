"use client";

import { useState, useEffect } from "react";
import TrendChart from "@/components/TrendChart";
import { fetchTrends } from "@/lib/api";
import { TrendPoint } from "@/lib/types";

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchTrends(days)
      .then(setTrends)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  // 计算统计
  const totalCount = trends.reduce((sum, p) => sum + p.count, 0);
  const avgPerDay = trends.length > 0 ? (totalCount / trends.length).toFixed(1) : "0";
  const maxDay = trends.reduce(
    (max, p) => (p.count > max.count ? p : max),
    { date: "", count: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">趋势分析</h2>
          <p className="text-sm text-slate-500 mt-1">需求发现量随时间的变化趋势</p>
        </div>

        {/* 时间范围选择 */}
        <div className="flex items-center gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {d}天
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-sm text-slate-500">总需求量</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-sm text-slate-500">日均发现</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{avgPerDay}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <span className="text-sm text-slate-500">峰值日</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{maxDay.count} 条</p>
          <p className="text-xs text-slate-400">{maxDay.date}</p>
        </div>
      </div>

      {/* 趋势图 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400 text-sm">加载中...</div>
        </div>
      ) : (
        <TrendChart data={trends} height={400} />
      )}
    </div>
  );
}
