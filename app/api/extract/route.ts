/**
 * LLM 需求抽取 API — 拆解后的 Pipeline 第二步
 *
 * 从数据库取出未处理的原始帖子, 逐条调用 LLM 抽取需求卡片, 入库
 * 设计为单次调用处理 N 条 (默认 5 条, 控制在 10 秒内)
 *
 * POST /api/extract   Body: { limit? }
 * GET  /api/extract?limit=10  (供 Cron 调用)
 */

import { prisma } from "@/lib/db";
import { DemandCardExtractor, computeScores } from "@/lib/extractors/demand-card";
import type { CollectedPost } from "@/lib/collectors/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 核心提取逻辑（POST 和 GET 共用）
 */
async function runExtract(limit: number) {
  console.log(`[Pipeline/Extract] Processing up to ${limit} posts`);

  // 1. 查找尚未处理的原始帖子 (processedAt 为 null)
  const rawPosts = await prisma.rawPost.findMany({
    where: { processedAt: null },
    take: limit,
    orderBy: { score: "desc" },
  });

  if (rawPosts.length === 0) {
    return { message: "No posts to extract", extracted: 0 };
  }

  // 2. 转换为 CollectedPost 格式
  const posts: CollectedPost[] = rawPosts.map((rp) => ({
    source: rp.source as any,
    external_id: rp.externalId,
    title: rp.title,
    body: rp.body,
    url: rp.url,
    author: rp.author,
    score: rp.score,
    num_comments: rp.numComments,
    language: rp.language,
    published_at: rp.publishedAt,
    comments: null,
    external_content: null,
  }));

  // 3. 标记帖子为已处理
  await prisma.rawPost.updateMany({
    where: { id: { in: rawPosts.map((p) => p.id) } },
    data: { processedAt: new Date() },
  });

  // 4. LLM 批量抽取
  const extractor = new DemandCardExtractor();
  const extracted = await extractor.extractBatch(posts);

  console.log(`[Pipeline/Extract] Extracted ${extracted.length} demand cards`);

  // 5. 入库需求卡片
  let savedCount = 0;
  for (const { post, demand } of extracted) {
    const rawPost = rawPosts.find((rp) => rp.externalId === post.external_id);
    if (!rawPost) continue;

    const scores = computeScores(post, demand);

    await prisma.demandCard.create({
      data: {
        rawPost: { connect: { id: rawPost.id } },
        domain: demand.domain,
        subDomain: demand.sub_domain || null,
        persona: demand.persona || null,
        painPoint: demand.pain_point,
        desiredOutcome: demand.desired_outcome || null,
        currentAlternative: demand.current_alternative || null,
        evidenceType: demand.evidence_type as any,
        intensity: demand.intensity,
        mentionedTools: JSON.stringify(demand.mentioned_tools || []),
        source: post.source as any,
        url: post.url,
        publishedAt: post.published_at,
        ...scores,
      },
    });
    savedCount++;
  }

  // 6. 更新采集记录
  if (extracted.length > 0) {
    await prisma.collectionRun.updateMany({
      where: { status: "done", source: posts[0].source as any },
      data: { cardsExtracted: { increment: savedCount } },
    });
  }

  console.log(`[Pipeline/Extract] Saved ${savedCount} demand cards`);

  return {
    message: "Extraction complete",
    processed: rawPosts.length,
    extracted: savedCount,
  };
}

/** POST 手动调用 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit: number = body.limit || 5;

    const result = await runExtract(limit);
    return Response.json(result);
  } catch (err: any) {
    console.error("[Pipeline/Extract] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/** GET 供 Vercel Cron 调用 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit: number = parseInt(searchParams.get("limit") || "10", 10);

    const result = await runExtract(limit);
    return Response.json(result);
  } catch (err: any) {
    console.error("[Pipeline/Extract/GET] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
