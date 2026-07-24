/**
 * 需求列表 API — 对应 FastAPI 的 /api/demands
 *
 * 支持: 筛选(domain, source, min_intensity) + 排序 + 分页
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const domain = searchParams.get("domain") || undefined;
  const source = searchParams.get("source") || undefined;
  const minIntensity = parseInt(searchParams.get("min_intensity") || "0") || 0;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
  const offset = parseInt(searchParams.get("offset") || "0") || 0;
  const sortBy = searchParams.get("sort_by") || "overall_score";

  // 排序映射
  const orderBy: Record<string, "desc" | "asc"> = {};
  const sortColumn = sortBy === "intensity" ? "intensity" : sortBy === "published_at" ? "publishedAt" : "overallScore";
  orderBy[sortColumn] = "desc";

  // 构建查询条件
  const where: Record<string, any> = {};
  if (domain) where.domain = domain;
  if (source) where.source = source;
  if (minIntensity > 0) where.intensity = { gte: minIntensity };

  const cards = await prisma.demandCard.findMany({
    where,
    orderBy,
    take: limit,
    skip: offset,
  });

  // 转换字段名 (camelCase → snake_case, 与原 API 保持一致)
  const result = cards.map((c) => ({
    id: c.id,
    domain: c.domain,
    sub_domain: c.subDomain,
    persona: c.persona,
    pain_point: c.painPoint,
    desired_outcome: c.desiredOutcome,
    current_alternative: c.currentAlternative,
    evidence_type: c.evidenceType,
    intensity: c.intensity,
    mentioned_tools: JSON.parse(c.mentionedTools || "[]"),
    source: c.source,
    url: c.url,
    published_at: c.publishedAt?.toISOString() || null,
    overall_score: c.overallScore,
    frequency_score: c.frequencyScore,
    recency_score: c.recencyScore,
    market_score: c.marketScore,
    competition_score: c.competitionScore,
  }));

  return Response.json(result);
}
