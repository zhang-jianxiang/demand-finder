/**
 * Cron 定时任务 API — 每天 1 次自动采集 + 提取
 *
 * 流程:
 *   1. 采集小红书/知乎数据 (15 条, 3 个关键词)
 *   2. LLM 提取需求卡片 (最多 5 条)
 *
 * Vercel Cron 会发送 GET 请求
 * 配置在 vercel.json 中: schedule "0 0 * * *" (每天 UTC 0 点)
 *
 * 也可手动调用: GET /api/cron
 */

import { prisma } from "@/lib/db";
import { collectZhihu } from "@/lib/collectors/zhihu";
import { collectXiaohongshu } from "@/lib/collectors/xiaohongshu";
import { DemandCardExtractor, computeScores } from "@/lib/extractors/demand-card";
import type { CollectedPost } from "@/lib/collectors/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const startTime = Date.now();
  console.log("[Cron] 定时任务开始执行");

  const url = new URL(request.url);
  const step = url.searchParams.get("step");
  const doCollect = step !== "extract";
  const doExtract = step !== "collect";
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const useXhs = dayOfYear % 2 === 0;
  console.log(`[Cron] step=${step || "all"}, collect=${doCollect}, extract=${doExtract}, platform=${useXhs ? "xiaohongshu" : "zhihu"}`);


  try {
    // ═══════════════════════════════════════
    // 第一步: 采集小红书 + 知乎
    // ═══════════════════════════════════════
    const results: { source: string; collected: number; saved: number }[] = [];
    if (doCollect) {

    const platforms = useXhs
      ? [{ source: "xiaohongshu", collector: collectXiaohongshu }]
      : [{ source: "zhihu", collector: collectZhihu }];
    for (const { source, collector } of platforms) {
      try {
        console.log(`[Cron] 采集 ${source}...`);
        const posts = await collector(15, 3);

        if (posts.length > 0) {
          // 入库
          let savedCount = 0;
          for (const post of posts) {
            const existing = await prisma.rawPost.findUnique({
              where: {
                source_externalId: { source: post.source, externalId: post.external_id },
              },
            });
            if (existing) continue;

            const bodyParts = [post.body || ""];
            if (post.comments) bodyParts.push(`\n\n--- 评论区 ---\n${post.comments}`);
            if (post.external_content) bodyParts.push(`\n\n--- 外链内容 ---\n${post.external_content}`);

            await prisma.rawPost.create({
              data: {
                source: post.source,
                externalId: post.external_id,
                title: post.title,
                body: bodyParts.join("\n"),
                url: post.url,
                author: post.author,
                score: post.score,
                numComments: post.num_comments,
                language: post.language,
                publishedAt: post.published_at,
              },
            });
            savedCount++;
          }

          // 记录采集批次
          await prisma.collectionRun.create({
            data: {
              source: source as any,
              status: "done",
              postsCollected: savedCount,
              cardsExtracted: 0,
              finishedAt: new Date(),
            },
          });

          results.push({ source, collected: posts.length, saved: savedCount });
          console.log(`[Cron] ${source} 采集完成: ${savedCount}/${posts.length}`);
        } else {
          results.push({ source, collected: 0, saved: 0 });
          console.log(`[Cron] ${source} 无数据`);
        }
      } catch (err: any) {
        console.error(`[Cron] 采集 ${source} 失败:`, err.message);
        results.push({ source, collected: 0, saved: 0 });
      }
    }
    } // end doCollect

    // ═══════════════════════════════════════
    // 第二步: LLM 提取需求卡片
    // ═══════════════════════════════════════
    let extracted = 0;
    let processed = 0;

    if (doExtract) {
    try {
      console.log("[Cron] 开始 LLM 提取...");

      const rawPosts = await prisma.rawPost.findMany({
        where: { processedAt: null },
        take: 5,
        orderBy: { score: "desc" },
      });

      if (rawPosts.length > 0) {
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

        // 标记为已处理
        await prisma.rawPost.updateMany({
          where: { id: { in: rawPosts.map((p) => p.id) } },
          data: { processedAt: new Date() },
        });

        // LLM 提取
        const extractor = new DemandCardExtractor();
        const extractedCards = await extractor.extractBatch(posts);

        // 入库
        for (const { post, demand } of extractedCards) {
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
          extracted++;
        }

        processed = rawPosts.length;
        console.log(`[Cron] LLM 提取完成: ${extracted}/${processed}`);
      } else {
        console.log("[Cron] 无待处理帖子");
      }
    } catch (err: any) {
      console.error("[Cron] LLM 提取失败:", err.message);
    }
    } // end doExtract

    // ═══════════════════════════════════════
    // 返回汇总
    // ═══════════════════════════════════════
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] 定时任务完成, 耗时 ${elapsed}s`);

    return Response.json({
      message: "Cron job complete",
      duration: `${elapsed}s`,
      collection: results,
      extraction: { processed, extracted },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron] 定时任务失败:", err);
    return Response.json({ error: err.message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
