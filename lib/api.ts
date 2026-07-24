/**
 * API 调用层 — 统一封装数据获取逻辑
 *
 * 全栈 Next.js 模式: API Routes 在同域, 直接用相对路径 /api/xxx
 * 始终优先从 API 获取真实数据, 失败时回退到 Mock 数据
 */

import { DemandCard, DemandQuery, DomainStats, TrendPoint } from "./types";
import { mockDemands, mockDomainStats, generateMockTrends } from "./mockData";

/** API 基础路径 (同域) */
const API_BASE = "/api";

/**
 * 获取需求列表(排行榜)
 */
export async function fetchDemands(query: DemandQuery = {}): Promise<DemandCard[]> {
  const params = new URLSearchParams();
  if (query.domain) params.set("domain", query.domain);
  if (query.source) params.set("source", query.source);
  if (query.min_intensity) params.set("min_intensity", String(query.min_intensity));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.sort_by) params.set("sort_by", query.sort_by);

  try {
    const resp = await fetch(`${API_BASE}/demands?${params}`, {
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`Failed to fetch demands: ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) return data;
    // 数据库为空时也返回空数组 (不是错误)
    if (Array.isArray(data)) return data;
    throw new Error("Invalid response format");
  } catch (err) {
    console.warn("[API] fetchDemands failed, using mock data:", err);
    return mockFilterDemands(query);
  }
}

/**
 * 获取单条需求详情
 */
export async function fetchDemandById(id: string): Promise<DemandCard | null> {
  try {
    const resp = await fetch(`${API_BASE}/demands/${id}`, {
      cache: "no-store",
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch (err) {
    console.warn("[API] fetchDemandById failed, using mock data:", err);
    return mockDemands.find((d) => d.id === id) || null;
  }
}

/**
 * 获取领域统计
 */
export async function fetchDomainStats(): Promise<DomainStats[]> {
  try {
    const resp = await fetch(`${API_BASE}/domains`, {
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`Failed to fetch domain stats: ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data)) return data;
    throw new Error("Invalid response format");
  } catch (err) {
    console.warn("[API] fetchDomainStats failed, using mock data:", err);
    return mockDomainStats;
  }
}

/**
 * 获取趋势数据
 */
export async function fetchTrends(days: number = 30): Promise<TrendPoint[]> {
  try {
    const resp = await fetch(`${API_BASE}/trends?days=${days}`, {
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`Failed to fetch trends: ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data)) return data;
    throw new Error("Invalid response format");
  } catch (err) {
    console.warn("[API] fetchTrends failed, using mock data:", err);
    return generateMockTrends(days);
  }
}

// ── Mock 过滤逻辑 ──

function mockFilterDemands(query: DemandQuery): DemandCard[] {
  let results = [...mockDemands];

  if (query.domain) {
    results = results.filter((d) => d.domain === query.domain);
  }
  if (query.source) {
    results = results.filter((d) => d.source === query.source);
  }
  if (query.min_intensity) {
    results = results.filter((d) => d.intensity >= query.min_intensity!);
  }

  // 排序
  const sortBy = query.sort_by || "overall_score";
  results.sort((a, b) => {
    if (sortBy === "intensity") return b.intensity - a.intensity;
    if (sortBy === "published_at") {
      return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
    }
    return b.overall_score - a.overall_score;
  });

  // 分页
  const offset = query.offset || 0;
  const limit = query.limit || 50;
  return results.slice(offset, offset + limit);
}
