/**
 * 需求趋势 API — 对应 FastAPI 的 /api/trends
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const days = Math.min(parseInt(request.nextUrl.searchParams.get("days") || "30"), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Prisma 按日期分组
  const records = await prisma.demandCard.findMany({
    where: { publishedAt: { gte: since } },
    select: { publishedAt: true },
  });

  // 手动按天聚合
  const dayMap = new Map<string, number>();
  for (const r of records) {
    if (!r.publishedAt) continue;
    const dateKey = r.publishedAt.toISOString().slice(0, 10);
    dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
  }

  // 填充缺失日期
  const result: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    result.push({ date: dateKey, count: dayMap.get(dateKey) || 0 });
  }

  return Response.json(result);
}
