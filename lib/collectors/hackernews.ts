/**
 * HackerNews 采集器 — 对应 Python 的 collectors/hackernews.py
 *
 * 通过 Algolia Search API 拉取帖子 + 评论区
 * API: https://hn.algolia.com/api
 */

import { config } from "@/lib/config";
import { CollectedPost, isLikelyDemandSignal, dedupPosts } from "./types";

const HN_BASE = config.HN_ALGOLIA_URL;
const TIMEOUT_MS = 30_000;

/** 带重试的 fetch */
async function fetchWithRetry(url: string, params: Record<string, string>, maxRetries = 3): Promise<any> {
  const fullUrl = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    fullUrl.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(fullUrl.toString(), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.min(2000 * Math.pow(2, attempt), 10000)));
    }
  }
}

/** 递归提取评论树文本 */
function extractComments(itemData: any, depth = 0): string {
  if (!itemData || depth > 3) return "";

  const parts: string[] = [];
  const children = itemData.children || [];

  for (const child of children) {
    const text = child.text || "";
    if (text) {
      // 去除 HTML 标签
      const clean = text.replace(/<[^>]+>/g, "").trim();
      if (clean.length > 5) {
        const indent = "  ".repeat(depth);
        parts.push(`${indent}- ${clean}`);
      }
    }

    const sub = extractComments(child, depth + 1);
    if (sub) parts.push(sub);

    if (parts.length >= 15) break; // 最多 15 条评论
  }

  return parts.join("\n");
}

/** 解析 Algolia hit 为 CollectedPost */
function parseHit(hit: any): CollectedPost | null {
  const objectId = hit.objectID;
  if (!objectId) return null;

  let publishedAt: Date | null = null;
  const createdAt = hit.created_at;
  if (createdAt) {
    try {
      publishedAt = new Date(createdAt);
    } catch {
      // ignore
    }
  }

  return {
    source: "hackernews",
    external_id: String(objectId),
    title: hit.title || hit.story_title || null,
    body: hit.story_text || null,
    url: hit.url || `https://news.ycombinator.com/item?id=${objectId}`,
    author: hit.author || null,
    score: hit.points || 0,
    num_comments: hit.num_comments || 0,
    language: "en",
    published_at: publishedAt,
    comments: null,
    external_content: null,
  };
}

/** 主采集函数 */
export async function collectHackerNews(maxResults = 50): Promise<CollectedPost[]> {
  const keywords = config.hnKeywordList;
  if (keywords.length === 0) {
    console.warn("[HN] No keywords configured");
    return [];
  }

  const perKeyword = Math.max(10, Math.floor(maxResults / keywords.length));
  const allPosts: CollectedPost[] = [];

  for (const keyword of keywords) {
    try {
      const data = await fetchWithRetry(`${HN_BASE}/search_by_date`, {
        query: keyword,
        tags: "story",
        hitsPerPage: String(Math.min(perKeyword, 50)),
        numericFilters: "points>5",
      });

      const hits = data.hits || [];
      console.log(`[HN] search '${keyword}': ${hits.length} hits`);

      for (const hit of hits) {
        const post = parseHit(hit);
        if (post && isLikelyDemandSignal(post)) {
          allPosts.push(post);
        }
      }
    } catch (err) {
      console.error(`[HN] collect failed for '${keyword}':`, err);
    }
  }

  // 去重
  const unique = dedupPosts(allPosts);
  console.log(`[HN] total collected: ${unique.length} (after dedup & filter)`);

  // 抓取评论区（并发）
  const postsToEnrich = unique.slice(0, maxResults);
  const commentPromises = postsToEnrich.map((post) => fetchComments(post));
  await Promise.allSettled(commentPromises);

  const enriched = postsToEnrich.filter((p) => p.comments).length;
  console.log(`[HN] comments fetched: ${enriched}/${postsToEnrich.length} enriched`);

  return postsToEnrich;
}

/** 获取帖子评论树 */
async function fetchComments(post: CollectedPost): Promise<void> {
  try {
    const data = await fetchWithRetry(`${HN_BASE}/items/${post.external_id}`, {});
    const commentsText = extractComments(data);
    if (commentsText) {
      post.comments = commentsText.slice(0, 3000);
    }
  } catch (err) {
    // 静默失败
  }
}
