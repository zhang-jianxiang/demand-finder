"use client";

import clsx from "clsx";

export interface FilterState {
  domain: string | "";
  source: string | "";
  minIntensity: number;
  sortBy: "overall_score" | "intensity" | "published_at";
}

interface FilterBarProps {
  filters: FilterState;
  domains: string[];
  onChange: (filters: FilterState) => void;
}

const sortOptions = [
  { value: "overall_score" as const, label: "综合得分" },
  { value: "intensity" as const, label: "需求强度" },
  { value: "published_at" as const, label: "最新发布" },
];

const sourceOptions = [
  { value: "", label: "全部来源" },
  { value: "zhihu", label: "知乎" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "weibo", label: "微博" },
  { value: "douyin", label: "抖音" },
  { value: "bilibili", label: "B站" },
  { value: "reddit", label: "Reddit" },
  { value: "hackernews", label: "HackerNews" },
];

export default function FilterBar({ filters, domains, onChange }: FilterBarProps) {
  const domainOptions = [
    { value: "", label: "全部领域" },
    ...domains.map((d) => ({ value: d, label: d })),
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
      <div className="flex flex-wrap items-center gap-4">
        {/* 领域筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 font-medium">领域</label>
          <select
            value={filters.domain}
            onChange={(e) => onChange({ ...filters, domain: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none cursor-pointer"
          >
            {domainOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 来源筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 font-medium">来源</label>
          <select
            value={filters.source}
            onChange={(e) => onChange({ ...filters, source: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none cursor-pointer"
          >
            {sourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 最低强度 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 font-medium">最低强度</label>
          <div className="flex items-center gap-1">
            {[0, 5, 7, 8].map((val) => (
              <button
                key={val}
                onClick={() => onChange({ ...filters, minIntensity: val })}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  filters.minIntensity === val
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {val === 0 ? "全部" : `≥${val}`}
              </button>
            ))}
          </div>
        </div>

        {/* 排序 */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-slate-500 font-medium">排序</label>
          <div className="flex items-center gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ ...filters, sortBy: opt.value })}
                className={clsx(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  filters.sortBy === opt.value
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
