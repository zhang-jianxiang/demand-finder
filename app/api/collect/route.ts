/**
 * 数据采集 API — 拆解后的 Pipeline 第一步
 *
 * 采集 知乎/小红书/Reddit/HN 帖子 + 网页正文富化 + 入库原始帖子
 * 设计为单次调用 < 10 秒 (单关键词/单板块)
 *
 * POST /api/collect   Body: { source, keyword?, maxResults? }
 * GET  /api/collect?source=xiaohongshu&maxResults=20  (供 Cron 调用)
 */

import { prisma } from "@/lib/db";
import { collectHackerNews } from "@/lib/collectors/hackernews";
import { collectReddit } from "@/lib/collectors/reddit";
import { collectZhihu } from "@/lib/collectors/zhihu";
import { collectXiaohongshu } from "@/lib/collectors/xiaohongshu";
import { enrichPosts } from "@/lib/collectors/web-scraper";
import type { CollectedPost } from "@/lib/collectors/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 核心采集逻辑（POST 和 GET 共用）
 */
async function runCollect(source: string, maxResults: number) {
  console.log(`[Pipeline/Collect] source=${source}, max=${maxResults}`);

  // 1. 采集
  let posts: CollectedPost[] = [];
  switch (source) {
    case "zhihu":
      posts = await collectZhihu(maxResults);
      break;
    case "xiaohongshu":
      posts = await collectXiaohongshu(maxResults);
      break;
    case "reddit":
      posts = await collectReddit(maxResults);
      break;
    case "hackernews":
      posts = await collectHackerNews(maxResults);
      break;
    default:
      return { error: `Unknown source: ${source}`, status: 400 };
  }

  if (posts.length === 0) {
    return { message: "No posts collected", collected: 0, saved: 0 };
  }

  // 2. 网页正文富化
  await enrichPosts(posts);

  // 3. 入库原始帖子 (跳过已存在的)
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

  console.log(`[Pipeline/Collect] Saved ${savedCount}/${posts.length} posts to DB`);

  // 4. 记录采集批次
  await prisma.collectionRun.create({
    data: {
      source: source as any,
      status: "done",
      postsCollected: savedCount,
      cardsExtracted: 0,
      finishedAt: new Date(),
    },
  });

  return {
    message: "Collection complete",
    collected: posts.length,
    saved: savedCount,
    source,
  };
}

/** POST 手动调用 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const source: string = body.source || "zhihu";
    const maxResults: number = body.maxResults || 20;

    const result = await runCollect(source, maxResults);

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result);
  } catch (err: any) {
    console.error("[Pipeline/Collect] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/** GET 供 Vercel Cron 调用 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source: string = searchParams.get("source") || "xiaohongshu";
    const maxResults: number = parseInt(searchParams.get("maxResults") || "20", 10);

    const result = await runCollect(source, maxResults);

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result);
  } catch (err: any) {
    console.error("[Pipeline/Collect/GET] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
