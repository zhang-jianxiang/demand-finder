"use client";

import { useState, useEffect, useCallback } from "react";
import DemandCardItem from "@/components/DemandCardItem";
import FilterBar, { FilterState } from "@/components/FilterBar";
import StatsBar from "@/components/StatsBar";
import TrendChart from "@/components/TrendChart";
import { fetchDemands, fetchDomainStats, fetchTrends } from "@/lib/api";
import { DemandCard, DomainStats, TrendPoint } from "@/lib/types";

export default function HomePage() {
  const [demands, setDemands] = useState<DemandCard[]>([]);
  const [stats, setStats] = useState<DomainStats[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    domain: "",
    source: "",
    minIntensity: 0,
    sortBy: "overall_score",
  });

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [demandsData, statsData, trendsData] = await Promise.all([
        fetchDemands({
          domain: filters.domain || undefined,
          source: filters.source || undefined,
          min_intensity: filters.minIntensity || undefined,
          sort_by: filters.sortBy,
          limit: 100,
        }),
        fetchDomainStats(),
        fetchTrends(30),
      ]);
      setDemands(demandsData);
      setStats(statsData);
      setTrends(trendsData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const domains = stats.map((s) => s.domain);

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">需求排行榜</h2>
        <p className="text-sm text-slate-500 mt-1">
          从知乎 / 小红书 / Reddit 等平台发现的生活与工作需求,按综合得分排序
        </p>
      </div>

      {/* 统计概览 */}
      <StatsBar stats={stats} totalCount={demands.length} />

      {/* 趋势图 */}
      <TrendChart data={trends} />

      {/* 筛选栏 */}
      <FilterBar filters={filters} domains={domains} onChange={setFilters} />

      {/* 需求列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400 text-sm">加载中...</div>
        </div>
      ) : demands.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400 text-sm">暂无符合条件的需求</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {demands.map((card) => (
            <DemandCardItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
