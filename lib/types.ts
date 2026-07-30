/**
 * 类型定义 — 面向生活/工作需求的多平台数据源
 */

/** 数据源 */
export type DataSource =
  | "hackernews"
  | "reddit"
  | "stackoverflow"
  | "zhihu"
  | "xiaohongshu"
  | "weibo"
  | "douyin"
  | "bilibili"
  | "twitter";

/** 证据类型 */
export type EvidenceType = "complaint" | "help_seeking" | "missing" | "comparison";

/** 需求卡片 */
export interface DemandCard {
  id: string;
  domain: string;
  sub_domain: string | null;
  persona: string | null;
  pain_point: string;
  desired_outcome: string | null;
  current_alternative: string | null;
  evidence_type: EvidenceType;
  intensity: number;
  mentioned_tools: string[];
  source: DataSource;
  url: string | null;
  published_at: string | null;
  overall_score: number;
  frequency_score: number;
  recency_score: number;
  market_score: number;
  competition_score: number;
}

/** 领域统计 */
export interface DomainStats {
  domain: string;
  count: number;
  avg_intensity: number;
}

/** 趋势数据点 */
export interface TrendPoint {
  date: string;
  count: number;
}

/** 排行榜查询参数 */
export interface DemandQuery {
  domain?: string;
  source?: string;
  min_intensity?: number;
  limit?: number;
  offset?: number;
  sort_by?: "overall_score" | "intensity" | "published_at";
}

/** 证据类型中文标签映射 */
export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  complaint: "抱怨",
  help_seeking: "求助",
  missing: "功能缺失",
  comparison: "对比",
};

/** 证据类型颜色映射 */
export const EVIDENCE_COLORS: Record<EvidenceType, string> = {
  complaint: "bg-red-100 text-red-700",
  help_seeking: "bg-amber-100 text-amber-700",
  missing: "bg-blue-100 text-blue-700",
  comparison: "bg-purple-100 text-purple-700",
};

/** 数据源中文标签映射 */
export const SOURCE_LABELS: Record<DataSource, string> = {
  hackernews: "HackerNews",
  reddit: "Reddit",
  stackoverflow: "StackOverflow",
  zhihu: "知乎",
  xiaohongshu: "小红书",
  weibo: "微博",
  douyin: "抖音",
  bilibili: "B站",
  twitter: "X/Twitter",
};

/** 数据源颜色映射 */
export const SOURCE_COLORS: Record<DataSource, string> = {
  hackernews: "bg-orange-100 text-orange-700",
  reddit: "bg-red-100 text-red-700",
  stackoverflow: "bg-blue-100 text-blue-700",
  zhihu: "bg-blue-100 text-blue-700",
  xiaohongshu: "bg-pink-100 text-pink-700",
  weibo: "bg-red-100 text-red-700",
  douyin: "bg-slate-100 text-slate-700",
  bilibili: "bg-pink-100 text-pink-700",
  twitter: "bg-slate-100 text-slate-800",
};

/** 需求强度颜色 */
export function intensityColor(intensity: number): string {
  if (intensity >= 8) return "bg-red-500";
  if (intensity >= 6) return "bg-orange-500";
  if (intensity >= 4) return "bg-yellow-500";
  return "bg-green-500";
}

/** 需求强度文字 */
export function intensityLabel(intensity: number): string {
  if (intensity >= 8) return "强烈";
  if (intensity >= 6) return "明显";
  if (intensity >= 4) return "中等";
  return "轻微";
}
