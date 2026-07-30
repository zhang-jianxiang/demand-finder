/**
 * X/Twitter 采集器 — 通过 TikHub API 搜索推文
 *
 * 端点: /api/v1/twitter/web/fetch_search_timeline
 *
 * Twitter/X 是发现英文需求的重要平台:
 * - "looking for an app that..." → 求助型需求
 * - "wish there was a tool for..." → 功能缺失型需求
 * - "frustrated with [product]" → 抱怨型需求
 * - "cheaper alternative to [product]" → 对比型需求
 *
 * 返回结构:
 * { code: 200, data: { timeline: [...], next_cursor, prev_cursor } }
 * 每条推文包含: tweet_id, screen_name, text, created_at,
 *              favorites, retweets, replies, views, lang, user_info
 */

import { config } from "@/lib/config";
import { CollectedPost, isLikelyDemandSignal, dedupPosts } from "./types";

const TIKHUB_BASE = config.TIKHUB_BASE_URL;
const TIMEOUT_MS = 30_000;

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.TIKHUB_API_KEY}`,
    Accept: "application/json",
  };
}

async function tikhubGet(endpoint: string, params: Record<string, string>): Promise<any | null> {
  const url = new URL(`${TIKHUB_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const resp = await fetch(url.toString(), {
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (resp.status === 402) {
      console.warn("[Twitter] TikHub 余额不足 (402)");
      return null;
    }
    if (resp.status === 403) {
      console.error("[Twitter] TikHub API Key 缺少 Twitter 权限 (403)");
      return null;
    }
    if (resp.status === 429) {
      console.warn("[Twitter] TikHub 限流 (429)");
      await new Promise((r) => setTimeout(r, 5000));
      return null;
    }
    if (!resp.ok) {
      console.warn(`[Twitter] TikHub 错误 ${resp.status}`);
      return null;
    }

    return resp.json();
  } catch (err) {
    console.error(`[Twitter] TikHub 请求失败:`, err);
    return null;
  }
}

/** 解析单条推文为 CollectedPost */
function parseTweet(item: any): CollectedPost | null {
  try {
    const tweetId = item.tweet_id || item.id || "";
    if (!tweetId) return null;

    const text = item.text || item.full_text || "";
    const screenName = item.screen_name || item.user_info?.screen_name || "";
    const author = item.user_info?.name || screenName;
    const score = (item.favorites || 0) + (item.retweets || 0) * 2;
    const numComments = item.replies || 0;
    const url = `https://x.com/${screenName}/status/${tweetId}`;

    let publishedAt: Date = new Date();
    const created = item.created_at;
    if (created) {
      try {
        // Twitter 时间格式: "Thu Jul 23 21:07:00 +0000 2026"
        publishedAt = new Date(created);
      } catch {
        // ignore
      }
    }

    const lang = item.lang || "en";

    // 提取引用推文内容作为补充
    let externalContent: string | null = null;
    if (item.quoted && typeof item.quoted === "object") {
      const quotedText = item.quoted.text || item.quoted.full_text || "";
      if (quotedText) {
        externalContent = `[Quoted Tweet] ${quotedText.slice(0, 500)}`;
      }
    }

    return {
      source: "twitter",
      external_id: String(tweetId),
      title: null, // Twitter 没有标题字段
      body: text,
      url,
      author,
      score: Number(score),
      num_comments: Number(numComments),
      language: lang,
      published_at: publishedAt,
      comments: null,
      external_content: externalContent,
    };
  } catch {
    return null;
  }
}

/** 从搜索结果中提取推文列表 */
function extractTweets(data: any, limit: number): CollectedPost[] {
  if (!data || data.code !== 200) return [];

  const timeline = data.data?.timeline;
  if (!Array.isArray(timeline)) return [];

  const posts: CollectedPost[] = [];
  for (const item of timeline.slice(0, limit)) {
    // 跳过非推文类型 (如 promoted)
    if (item.type && item.type !== "tweet" && item.type !== "TimelineTimelineItem") continue;
    const post = parseTweet(item);
    if (post) posts.push(post);
  }
  return posts;
}

/** 主采集函数 */
export async function collectTwitter(maxResults = 30, maxKeywords = 5): Promise<CollectedPost[]> {
  if (!config.TIKHUB_API_KEY) {
    console.warn("[Twitter] TikHub API Key 未配置，使用 Mock 数据");
    return collectMockData();
  }

  const allPosts: CollectedPost[] = [];
  const keywords = config.twitterKeywordList.slice(0, maxKeywords);

  // 搜索推文 — 使用 Top 搜索类型获取最相关结果
  for (const keyword of keywords) {
    try {
      const data = await tikhubGet("/api/v1/twitter/web/fetch_search_timeline", {
        keyword,
        search_type: "Top",
      });

      if (data) {
        const posts = extractTweets(data, Math.ceil(maxResults / keywords.length) + 5);
        allPosts.push(...posts);
        console.log(`[Twitter] 搜索 '${keyword}': ${posts.length} 条`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Twitter] 搜索 '${keyword}' 失败:`, err);
    }
  }

  // 需求信号过滤 + 去重
  const filtered = dedupPosts(allPosts).filter(isLikelyDemandSignal);
  console.log(`[Twitter] 采集完成: ${filtered.length} 条 (去重+过滤后)`);
  return filtered;
}

/** Mock 数据（API Key 未配置或余额不足时使用） */
function collectMockData(): CollectedPost[] {
  const mockTweets = [
    {
      text: "Looking for a simple app that tracks my reading progress across Kindle and physical books. Goodreads is too bloated, just want pages read + a streak counter.",
      author: "reader_life",
      favorites: 45,
      retweets: 3,
      replies: 12,
    },
    {
      text: "Wish there was a tool that automatically organizes my screenshots by content. I have 3000+ screenshots and can never find anything.",
      author: "screenshot_hoarder",
      favorites: 89,
      retweets: 15,
      replies: 23,
    },
    {
      text: "Frustrated with Notion's slow loading on mobile. Is there a lighter alternative that syncs well? I just need basic notes and to-do lists.",
      author: "minimalist_user",
      favorites: 67,
      retweets: 8,
      replies: 19,
    },
    {
      text: "Is there a tool for automatically transcribing meeting audio and extracting action items? Otter.ai is too expensive for personal use.",
      author: "meeting_notes",
      favorites: 34,
      retweets: 5,
      replies: 11,
    },
    {
      text: "Need a tool that blocks social media during work hours but lets me use messaging apps. Freedom and Cold Turkey block everything which is annoying.",
      author: "adhd_coder",
      favorites: 56,
      retweets: 12,
      replies: 18,
    },
    {
      text: "Cheaper alternative to Adobe Illustrator for simple vector graphics? I only need it occasionally and $30/month is too much.",
      author: "indie_designer",
      favorites: 78,
      retweets: 20,
      replies: 25,
    },
  ];

  const now = Date.now();
  return mockTweets.map((m, i) => ({
    source: "twitter" as const,
    external_id: `twitter_mock_${i + 1}`,
    title: null,
    body: m.text,
    url: `https://x.com/${m.author}/status/mock_${i + 1}`,
    author: m.author,
    score: m.favorites + m.retweets * 2,
    num_comments: m.replies,
    language: "en",
    published_at: new Date(now - (i + 1) * 3600_000),
    comments: null,
    external_content: null,
  }));
}
