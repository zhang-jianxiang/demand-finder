/**
 * 领域统计 API — 对应 FastAPI 的 /api/domains
 */

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await prisma.demandCard.groupBy({
    by: ["domain"],
    _count: { id: true },
    _avg: { intensity: true },
    orderBy: { _count: { id: "desc" } },
  });

  return Response.json(
    stats.map((s) => ({
      domain: s.domain,
      count: s._count.id,
      avg_intensity: Math.round((s._avg.intensity || 0) * 10) / 10,
    }))
  );
}
