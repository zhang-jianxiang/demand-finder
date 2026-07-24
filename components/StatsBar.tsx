"use client";

import clsx from "clsx";
import { DomainStats } from "@/lib/types";

interface StatsBarProps {
  stats: DomainStats[];
  totalCount: number;
}

export default function StatsBar({ stats, totalCount }: StatsBarProps) {
  const maxCount = Math.max(...stats.map((s) => s.count), 1);

  // 计算总平均强度
  const totalIntensity = stats.reduce((sum, s) => sum + s.avg_intensity * s.count, 0);
  const avgIntensity = totalCount > 0 ? (totalIntensity / totalCount).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      {/* 概览卡片 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-500">需求总数</span>
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-3xl font-bold text-slate-800">{totalCount}</p>
        <p className="text-xs text-green-500 mt-1">↗ 持续采集中</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-500">平均强度</span>
          <span className="text-2xl">⚡</span>
        </div>
        <p className="text-3xl font-bold text-slate-800">{avgIntensity}</p>
        <p className="text-xs text-slate-400 mt-1">满分 10 分</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-500">覆盖领域</span>
          <span className="text-2xl">🎯</span>
        </div>
        <p className="text-3xl font-bold text-slate-800">{stats.length}</p>
        <p className="text-xs text-slate-400 mt-1">个行业大类</p>
      </div>
    </div>
  );
}
