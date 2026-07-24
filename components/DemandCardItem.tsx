"use client";

import Link from "next/link";
import clsx from "clsx";
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

export default function DemandCardItem({ card }: { card: DemandCard }) {
  return (
    <Link href={`/demands/${card.id}`} className="block">
      <div className="card-hover bg-white rounded-xl border border-slate-200 p-5 cursor-pointer">
        {/* 头部:领域 + 强度 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
              {card.domain}
            </span>
            {card.sub_domain && (
              <span className="px-2.5 py-1 rounded-md bg-slate-50 text-slate-500 text-xs">
                {card.sub_domain}
              </span>
            )}
            <span
              className={clsx(
                "px-2 py-0.5 rounded text-xs font-medium",
                EVIDENCE_COLORS[card.evidence_type]
              )}
            >
              {EVIDENCE_LABELS[card.evidence_type]}
            </span>
          </div>

          {/* 强度徽章 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={clsx("w-2 h-2 rounded-full", intensityColor(card.intensity))} />
              <span className="text-xs text-slate-500">{intensityLabel(card.intensity)}</span>
            </div>
            <span className="text-lg font-bold text-slate-800">{card.intensity}</span>
          </div>
        </div>

        {/* 痛点描述 */}
        <p className="text-sm text-slate-800 leading-relaxed mb-3 line-clamp-2">
          {card.pain_point}
        </p>

        {/* 期望结果 */}
        {card.desired_outcome && (
          <div className="flex items-start gap-2 mb-3">
            <span className="text-xs text-green-600 font-medium flex-shrink-0 mt-0.5">
              期望 →
            </span>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-1">
              {card.desired_outcome}
            </p>
          </div>
        )}

        {/* 底部:工具标签 + 来源 + 时间 + 得分 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {card.mentioned_tools.slice(0, 3).map((tool) => (
              <span
                key={tool}
                className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 truncate"
              >
                {tool}
              </span>
            ))}
            {card.mentioned_tools.length > 3 && (
              <span className="text-xs text-slate-400">
                +{card.mentioned_tools.length - 3}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 来源 */}
            <span
              className={clsx(
                "px-1.5 py-0.5 rounded text-xs font-medium",
                SOURCE_COLORS[card.source]
              )}
            >
              {SOURCE_LABELS[card.source]}
            </span>
            {/* 时间 */}
            <span className="text-xs text-slate-400">
              {card.published_at ? formatRelativeTime(card.published_at) : "—"}
            </span>
            {/* 综合得分 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">得分</span>
              <span className="text-sm font-bold text-brand-600">
                {card.overall_score.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
