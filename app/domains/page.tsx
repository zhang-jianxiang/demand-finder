"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchDomainStats } from "@/lib/api";
import { DomainStats } from "@/lib/types";
import clsx from "clsx";

// 领域颜色映射 — 面向生活/工作需求
const DOMAIN_COLORS: Record<string, string> = {
  "家居收纳": "bg-orange-500",
  "育儿教育": "bg-pink-500",
  "职场效率": "bg-blue-500",
  "消费决策": "bg-green-500",
  "健康管理": "bg-red-500",
  "财务管理": "bg-purple-500",
  "生活服务": "bg-cyan-500",
  "社交关系": "bg-amber-500",
};

export default function DomainsPage() {
  const [stats, setStats] = useState<DomainStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomainStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(...stats.map((s) => s.count), 1);
  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">领域分布</h2>
        <p className="text-sm text-slate-500 mt-1">各生活/工作领域的需求分布与平均强度</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400 text-sm">加载中...</div>
        </div>
      ) : (
        <>
          {/* 总数 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500">需求总量</span>
              <span className="text-3xl font-bold text-slate-800">{totalCount}</span>
            </div>

            {/* 领域条形图 */}
            <div className="space-y-4 mt-6">
              {stats.map((s) => {
                const width = (s.count / maxCount) * 100;
                const color = DOMAIN_COLORS[s.domain] || "bg-slate-400";
                return (
                  <Link
                    key={s.domain}
                    href={`/?domain=${encodeURIComponent(s.domain)}`}
                    className="block group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 group-hover:text-brand-600 transition-colors">
                        {s.domain}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          平均强度 {s.avg_intensity}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{s.count}</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={clsx("h-full rounded-full transition-all duration-500", color)}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 领域卡片网格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((s) => {
              const color = DOMAIN_COLORS[s.domain] || "bg-slate-400";
              const percentage = ((s.count / totalCount) * 100).toFixed(1);
              return (
                <Link
                  key={s.domain}
                  href={`/?domain=${encodeURIComponent(s.domain)}`}
                  className="card-hover bg-white rounded-xl border border-slate-200 p-5 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={clsx("w-3 h-3 rounded-full", color)} />
                      <span className="font-semibold text-slate-800">{s.domain}</span>
                    </div>
                    <span className="text-xs text-slate-400">{percentage}%</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{s.count}</p>
                      <p className="text-xs text-slate-400">需求数</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{s.avg_intensity}</p>
                      <p className="text-xs text-slate-400">平均强度</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
