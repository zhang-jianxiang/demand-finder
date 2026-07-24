/**
 * Reddit 采集器 — 面向生活/工作类需求
 *
 * 通过 TikHub API 搜索 Reddit 帖子
 * 端点: /api/v1/reddit/app/fetch_dynamic_search
 *       /api/v1/reddit/app/fetch_subreddit_feed
 *       /api/v1/reddit/app/fetch_post_comments
 *
 * 默认关注生活/工作类 Subreddit:
 * LifeProTips, productivity, BuyItForLife, smallbusiness, Entrepreneur,
 * finance, home, Parenting, Cooking, DIY
 */

import { config } from "@/lib/config";
import { CollectedPost, isLikelyDemandSignal, dedupPosts } from "./types";

const TIKHUB_BASE = config.TIKHUB_BASE_URL;
const TIMEOUT_MS = 30_000;

const REDDIT_SEARCH_KEYWORDS = [
  "looking for", "wish there was", "frustrated with",
  "too expensive", "is there a tool", "any recommendation",
  "struggling with", "cheaper alternative", "need advice",
  "any tips", "how do you", "what do you use",
];

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
      console.warn("[Reddit] TikHub balance insufficient (402)");
      return null;
    }
    if (resp.status === 403) {
      console.error("[Reddit] TikHub API key lacks Reddit scope (403)");
      return null;
    }
    if (resp.status === 429) {
      console.warn("[Reddit] TikHub rate limit (429), waiting...");
      await new Promise((r) => setTimeout(r, 5000));
      return null;
    }
    if (!resp.ok) {
      console.warn(`[Reddit] TikHub error ${resp.status}`);
      return null;
    }

    return resp.json();
  } catch (err) {
    console.error(`[Reddit] TikHub request failed:`, err);
    return null;
  }
}

/** 解析 TikHub API 返回的帖子数据 */
function parsePost(item: any, subreddit = ""): CollectedPost | null {
  try {
    const postId = item.id || item.post_id || item.name || "";
    if (!postId) return null;

    const post = item.post || item;

    const title = post.postTitle || post.title || "";
    const body = post.content?.markdown || post.content?.html || post.selftext || post.body || "";
    const author = post.authorInfo?.name || post.author || post.username || "";
    const score = post.score || post.ups || 0;
    const numComments = post.commentCount || post.num_comments || post.comment_count || 0;
    const subredditName = subreddit || post.subreddit?.prefixedName?.replace("r/", "") || post.subreddit || "";

    const url = post.url || `https://www.reddit.com/r/${subredditName}/comments/${postId}`;

    let publishedAt: Date = new Date();
    const created = post.createdAt || post.created_utc || post.created_at;
    if (created) {
      try {
        if (typeof created === "number") {
          publishedAt = new Date(created * 1000);
        } else {
          publishedAt = new Date(created);
        }
      } catch {
        // ignore
      }
    }

    return {
      source: "reddit",
      external_id: String(postId),
      title,
      body,
      url,
      author,
      score: Number(score),
      num_comments: Number(numComments),
      language: "en",
      published_at: publishedAt,
      comments: null,
      external_content: null,
    };
  } catch (err) {
    return null;
  }
}

/** 从搜索结果中提取帖子列表 */
function extractPosts(data: any, limit: number, subreddit = ""): CollectedPost[] {
  if (!data || data.code !== 200) return [];

  const root = data.data;
  let items: any[] = [];

  try {
    const edges = root?.search?.dynamic?.components?.main?.edges || [];
    for (const edge of edges) {
      const children = edge?.node?.children || [];
      for (const child of children) {
        if (child?.post) {
          items.push(child);
        }
      }
    }
  } catch {
    items = root?.items || root?.posts || (Array.isArray(root) ? root : []) || [];
  }

  const posts: CollectedPost[] = [];
  for (const item of items.slice(0, limit)) {
    const post = parsePost(item, subreddit);
    if (post) posts.push(post);
  }
  return posts;
}

/** 主采集函数 */
export async function collectReddit(maxResults = 50): Promise<CollectedPost[]> {
  if (!config.TIKHUB_API_KEY) {
    console.warn("[Reddit] TikHub API key not configured, using mock data");
    return collectMockData();
  }

  const allPosts: CollectedPost[] = [];

  // 1. 关键词搜索
  for (const keyword of REDDIT_SEARCH_KEYWORDS.slice(0, 5)) {
    try {
      const data = await tikhubGet("/api/v1/reddit/app/fetch_dynamic_search", {
        query: keyword,
        search_type: "posts",
        sort: "RELEVANCE",
        time_range: "MONTH",
      });

      if (data) {
        const posts = extractPosts(data, 10);
        allPosts.push(...posts);
        console.log(`[Reddit] search '${keyword}': ${posts.length} posts`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Reddit] search '${keyword}' failed:`, err);
    }
  }

  // 2. 子版块 Feed (生活/工作类)
  for (const subreddit of config.subredditList.slice(0, 5)) {
    try {
      const data = await tikhubGet("/api/v1/reddit/app/fetch_subreddit_feed", {
        subreddit_name: subreddit,
        sort: "HOT",
      });

      if (data) {
        const posts = extractPosts(data, 10, subreddit);
        allPosts.push(...posts);
        console.log(`[Reddit] r/${subreddit}: ${posts.length} posts`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Reddit] r/${subreddit} failed:`, err);
    }
  }

  // 3. 获取热门帖子评论
  const sortedPosts = [...allPosts].sort((a, b) => b.score - a.score);
  for (const post of sortedPosts.slice(0, 10)) {
    if (post.num_comments > 0 && !post.comments) {
      const data = await tikhubGet("/api/v1/reddit/app/fetch_post_comments", {
        post_id: post.external_id,
        sort_type: "TOP",
      });

      if (data?.data?.comments) {
        const texts = data.data.comments
          .slice(0, 15)
          .map((c: any) => c.body || c.text || "")
          .filter((t: string) => t.length > 10)
          .map((t: string) => t.slice(0, 500));
        post.comments = texts.join("\n") || null;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const filtered = dedupPosts(allPosts).filter(isLikelyDemandSignal);
  console.log(`[Reddit] total collected: ${filtered.length} (after dedup & filter)`);
  return filtered;
}

/** Mock 数据 — 生活/工作类需求 */
function collectMockData(): CollectedPost[] {
  const mockPosts = [
    {
      title: "Looking for a simple meal planning app that actually works",
      body: "Tried Mealime, Paprika, Plan to Eat - they're all too complex. Just want something where I can pick recipes for the week and get a grocery list. Is there anything simpler?",
      comments: "Have you tried AnyList? It's basic but works. I just use Notes app honestly. MealBoard is decent.",
      subreddit: "Cooking",
      author: "busy_parent_42",
      score: 23,
      num_comments: 15,
    },
    {
      title: "Frustrated with kids' homework - any tools that actually help?",
      body: "Spending 2 hours every night helping with math homework. Khan Academy helps but kid still needs me sitting there. Any tools that make this easier?",
      comments: "Photomath is great for checking work. IXL has practice problems. Sometimes a tutor for just one session a week helps.",
      subreddit: "Parenting",
      author: "tired_dad",
      score: 45,
      num_comments: 28,
    },
    {
      title: "Is there a tool to track household expenses without manual entry?",
      body: "I've tried Mint, YNAB, EveryDollar. The problem is I always forget to categorize transactions. Need something that auto-categorizes and gives me a monthly summary.",
      comments: "Monarch Money does auto-categorization. Copilot Money is good for iOS. Rocket Money is worth checking out.",
      subreddit: "finance",
      author: "budget_struggler",
      score: 67,
      num_comments: 34,
    },
    {
      title: "Wish there was a simpler way to organize small kitchen spaces",
      body: "My kitchen is tiny and I can never find anything. Tried various organizers from Amazon but nothing really works well. Any recommendations from people with small kitchens?",
      comments: "Magnetic strips for spices. Tension rods for cabinets. Over-the-door organizers changed my life.",
      subreddit: "home",
      author: "small_apartment",
      score: 31,
      num_comments: 19,
    },
    {
      title: "Working from home - need a better way to stay focused",
      body: "I get distracted constantly. Tried Pomodoro timers, website blockers, noise-canceling headphones. Nothing sticks. What actually works for you?",
      comments: "Body doubling apps like Focusmate. Forest app for gamification. Going to a cafe instead. Having a dedicated workspace.",
      subreddit: "productivity",
      author: "wfh_struggles",
      score: 42,
      num_comments: 23,
    },
    {
      title: "Any recommendation for a vacuum that actually lasts?",
      body: "Bought 3 vacuums in 5 years and they all break. Looking for a buy-it-for-life vacuum that can handle pet hair. Dyson is too expensive.",
      comments: "Miele canister vacuums last 15+ years. Shark is a good mid-range option. Sebo is commercial grade.",
      subreddit: "BuyItForLife",
      author: "pet_owner",
      score: 29,
      num_comments: 17,
    },
  ];

  const now = Date.now();
  return mockPosts.map((m, i) => ({
    source: "reddit" as const,
    external_id: `reddit_mock_${i + 1}`,
    title: m.title,
    body: m.body,
    url: `https://reddit.com/r/${m.subreddit}/mock_${i + 1}`,
    author: m.author,
    score: m.score,
    num_comments: m.num_comments,
    language: "en",
    published_at: new Date(now - (i + 1) * 3600_000),
    comments: m.comments,
    external_content: null,
  }));
}
