/**
 * 单条需求详情 API — 对应 FastAPI 的 /api/demands/{card_id}
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const card = await prisma.demandCard.findUnique({
    where: { id: params.id },
  });

  if (!card) {
    return Response.json({ error: "Demand card not found" }, { status: 404 });
  }

  return Response.json({
    id: card.id,
    domain: card.domain,
    sub_domain: card.subDomain,
    persona: card.persona,
    pain_point: card.painPoint,
    desired_outcome: card.desiredOutcome,
    current_alternative: card.currentAlternative,
    evidence_type: card.evidenceType,
    intensity: card.intensity,
    mentioned_tools: JSON.parse(card.mentionedTools || "[]"),
    source: card.source,
    url: card.url,
    published_at: card.publishedAt?.toISOString() || null,
    overall_score: card.overallScore,
    frequency_score: card.frequencyScore,
    recency_score: card.recencyScore,
    market_score: card.marketScore,
    competition_score: card.competitionScore,
  });
}
