/**
 * 数据采集 API — 拆解后的 Pipeline 第一步
 *
 * 采集 知乎/小红书/Reddit/HN 帖子 + 网页正文富化 + 入库原始帖子
 * 设计为单次调用 < 10 秒 (单关键词/单板块)
 *
 * POST /api/collect
 * Body: { source: "zhihu" | "xiaohongshu" | "reddit" | "hackernews", keyword?: string, maxResults?: number }
 */

import { prisma } from "@/lib/db";
import { collectHackerNews } from "@/lib/collectors/hackernews";
import { collectReddit } from "@/lib/collectors/reddit";
import { collectZhihu } from "@/lib/collectors/zhihu";
import { collectXiaohongshu } from "@/lib/collectors/xiaohongshu";
import { enrichPosts } from "@/lib/collectors/web-scraper";
import type { CollectedPost } from "@/lib/collectors/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro 最大 60 秒

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const source: string = body.source || "zhihu";
    const maxResults: number = body.maxResults || 20;

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
        return Response.json({ error: `Unknown source: ${source}` }, { status: 400 });
    }

    if (posts.length === 0) {
      return Response.json({ message: "No posts collected", collected: 0 });
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

      // 拼接完整 body
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

    return Response.json({
      message: "Collection complete",
      collected: posts.length,
      saved: savedCount,
      source,
    });
  } catch (err: any) {
    console.error("[Pipeline/Collect] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
