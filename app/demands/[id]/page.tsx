"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { fetchDemandById } from "@/lib/api";
import {
  DemandCard,
  EVIDENCE_LABELS,
  EVIDENCE_COLORS,
  SOURCE_LABELS,
  SOURCE_COLORS,
  intensityColor,
  intensityLabel,
} from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

export default function DemandDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [card, setCard] = useState<DemandCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDemandById(id)
      .then(setCard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400 text-sm">加载中...</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-400 text-sm mb-4">未找到该需求</p>
        <Link href="/" className="text-brand-600 hover:underline text-sm">
          ← 返回排行榜
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* 返回链接 */}
      <Link href="/" className="text-sm text-slate-400 hover:text-brand-600 transition-colors">
        ← 返回排行榜
      </Link>

      {/* 主卡片 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* 标签行 */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
            {card.domain}
          </span>
          {card.sub_domain && (
            <span className="px-2.5 py-1 rounded-md bg-slate-50 text-slate-500 text-xs">
              {card.sub_domain}
            </span>
          )}
          <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", EVIDENCE_COLORS[card.evidence_type])}>
            {EVIDENCE_LABELS[card.evidence_type]}
          </span>
          <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", SOURCE_COLORS[card.source])}>
            {SOURCE_LABELS[card.source]}
          </span>
        </div>

        {/* 强度 + 得分 */}
        <div className="flex items-center gap-6 mb-5 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={clsx("w-3 h-3 rounded-full", intensityColor(card.intensity))} />
            <div>
              <p className="text-2xl font-bold text-slate-800">{card.intensity}</p>
              <p className="text-xs text-slate-400">需求强度 · {intensityLabel(card.intensity)}</p>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-600">{card.overall_score.toFixed(1)}</p>
            <p className="text-xs text-slate-400">综合得分</p>
          </div>
        </div>

        {/* 痛点 */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-1">
            <span>🔴</span> 痛点描述
          </h3>
          <p className="text-base text-slate-800 leading-relaxed">{card.pain_point}</p>
        </div>

        {/* 期望结果 */}
        {card.desired_outcome && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-1">
              <span>🟢</span> 期望结果
            </h3>
            <p className="text-base text-slate-700 leading-relaxed">{card.desired_outcome}</p>
          </div>
        )}

        {/* 当前替代方案 */}
        {card.current_alternative && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-1">
              <span>🟡</span> 当前替代方案
            </h3>
            <p className="text-base text-slate-600 leading-relaxed">{card.current_alternative}</p>
          </div>
        )}

        {/* 竞品工具 */}
        {card.mentioned_tools.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">提及的工具</h3>
            <div className="flex flex-wrap gap-2">
              {card.mentioned_tools.map((tool) => (
                <span
                  key={tool}
                  className="px-3 py-1.5 rounded-lg text-sm bg-blue-50 text-blue-700 font-medium"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 得分明细 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-500 mb-4">得分明细</h3>
        <div className="space-y-3">
          <ScoreBar label="频次分(需求广度)" value={card.frequency_score} max={5} />
          <ScoreBar label="时效分(近期趋势)" value={card.recency_score} max={1} />
          <ScoreBar label="市场分(讨论热度)" value={card.market_score} max={1} />
          <ScoreBar label="竞争分(蓝海程度)" value={card.competition_score} max={1} />
        </div>
      </div>

      {/* 来源信息 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">来源信息</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">数据源</span>
            <p className="text-slate-700 font-medium">{SOURCE_LABELS[card.source]}</p>
          </div>
          <div>
            <span className="text-slate-400">受众人群</span>
            <p className="text-slate-700 font-medium">{card.persona || "—"}</p>
          </div>
          <div>
            <span className="text-slate-400">发布时间</span>
            <p className="text-slate-700 font-medium">
              {card.published_at ? formatRelativeTime(card.published_at) : "—"}
            </p>
          </div>
          {card.url && (
            <div>
              <span className="text-slate-400">原始链接</span>
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline block truncate"
              >
                查看原文 ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 得分条 */
function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-medium text-slate-800">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
