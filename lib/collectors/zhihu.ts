/**
 * 知乎采集器 — 通过 TikHub API 搜索知乎问答
 *
 * 端点: /api/v1/zhihu/web/fetch_article_search_v3
 *
 * 知乎是发现中文需求的核心平台:
 * - "有没有好用的xxx" → 求助型需求
 * - "xxx太麻烦了怎么办" → 痛点型需求
 * - "xxx是不是智商税" → 消费决策需求
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
      console.warn("[知乎] TikHub 余额不足 (402)");
      return null;
    }
    if (resp.status === 403) {
      console.error("[知乎] TikHub API Key 缺少知乎权限 (403)");
      return null;
    }
    if (resp.status === 429) {
      console.warn("[知乎] TikHub 限流 (429)");
      await new Promise((r) => setTimeout(r, 5000));
      return null;
    }
    if (!resp.ok) {
      console.warn(`[知乎] TikHub 错误 ${resp.status}`);
      return null;
    }

    return resp.json();
  } catch (err) {
    console.error(`[知乎] TikHub 请求失败:`, err);
    return null;
  }
}

/** 解析知乎搜索结果中的条目 */
function parseAnswer(item: any): CollectedPost | null {
  try {
    const id = item.id || item.answer_id || item.url || "";
    if (!id) return null;

    const title = item.question?.title || item.title || "";
    const body = item.content || item.excerpt || item.body || "";
    const author = item.author?.name || item.author_name || "";
    const score = item.voteup_count || item.vote_count || 0;
    const numComments = item.comment_count || 0;
    const url = item.url || `https://www.zhihu.com/answer/${id}`;

    let publishedAt: Date = new Date();
    const created = item.created_time || item.updated_time || item.published_at;
    if (created) {
      try {
        publishedAt = typeof created === "number"
          ? new Date(created * 1000)
          : new Date(created);
      } catch { /* ignore */ }
    }

    return {
      source: "zhihu",
      external_id: String(id),
      title,
      body: typeof body === "string" ? body.replace(/<[^>]+>/g, "").trim() : "",
      url,
      author,
      score: Number(score),
      num_comments: Number(numComments),
      language: "zh",
      published_at: publishedAt,
      comments: null,
      external_content: null,
    };
  } catch {
    return null;
  }
}

/** 解析知乎文章 */
function parseArticle(item: any): CollectedPost | null {
  try {
    const id = item.id || item.article_id || item.url || "";
    if (!id) return null;

    const title = item.title || "";
    const body = item.content || item.excerpt || "";
    const author = item.author?.name || item.author_name || "";
    const score = item.voteup_count || item.vote_count || 0;
    const numComments = item.comment_count || 0;
    const url = item.url || `https://zhuanlan.zhihu.com/p/${id}`;

    let publishedAt: Date = new Date();
    const created = item.created || item.published_at;
    if (created) {
      try {
        publishedAt = typeof created === "number"
          ? new Date(created * 1000)
          : new Date(created);
      } catch { /* ignore */ }
    }

    return {
      source: "zhihu",
      external_id: String(id),
      title,
      body: typeof body === "string" ? body.replace(/<[^>]+>/g, "").trim() : "",
      url,
      author,
      score: Number(score),
      num_comments: Number(numComments),
      language: "zh",
      published_at: publishedAt,
      comments: null,
      external_content: null,
    };
  } catch {
    return null;
  }
}

/** 从搜索结果中提取帖子列表 */
function extractPosts(data: any, limit: number): CollectedPost[] {
  if (!data) return [];

  // TikHub 返回格式: { code: 200, data: [...] } 或 { data: { data: [...] } }
  let items: any[] = [];
  try {
    const root = data.data;
    if (Array.isArray(root)) {
      items = root;
    } else if (Array.isArray(root?.data)) {
      items = root.data;
    } else if (Array.isArray(root?.items)) {
      items = root.items;
    } else if (Array.isArray(root?.search_results)) {
      items = root.search_results;
    }
  } catch {
    items = [];
  }

  const posts: CollectedPost[] = [];
  for (const item of items.slice(0, limit)) {
    const post = parseAnswer(item) || parseArticle(item);
    if (post) posts.push(post);
  }
  return posts;
}

/** 主采集函数 */
export async function collectZhihu(maxResults = 30, maxKeywords = 5): Promise<CollectedPost[]> {
  if (!config.TIKHUB_API_KEY) {
    console.warn("[知乎] TikHub API Key 未配置，使用 Mock 数据");
    return collectMockData();
  }

  const allPosts: CollectedPost[] = [];
  const keywords = config.zhihuKeywordList.slice(0, maxKeywords);

  // 搜索知乎文章 (fetch_article_search_v3)
  for (const keyword of keywords) {
    try {
      const data = await tikhubGet("/api/v1/zhihu/web/fetch_article_search_v3", {
        keyword: keyword,
        sort: "",
        offset: "0",
        limit: "10",
      });

      if (data) {
        const posts = extractPosts(data, 8);
        allPosts.push(...posts);
        console.log(`[知乎] 文章搜索 '${keyword}': ${posts.length} 条`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[知乎] 文章搜索 '${keyword}' 失败:`, err);
    }
  }

  // 搜索知乎回答 (search-answer) — 回答通常包含更具体的需求描述
  for (const keyword of keywords.slice(0, 3)) {
    try {
      const data = await tikhubGet("/api/v1/zhihu/web/search/search-answer", {
        keyword: keyword,
        sort: "",
        offset: "0",
        limit: "10",
      });

      if (data) {
        const posts = extractPosts(data, 8);
        allPosts.push(...posts);
        console.log(`[知乎] 回答搜索 '${keyword}': ${posts.length} 条`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[知乎] 回答搜索 '${keyword}' 失败:`, err);
    }
  }

  // 搜索关键词本身就是需求信号，跳过二次过滤，仅去重
  const filtered = dedupPosts(allPosts);
  console.log(`[知乎] 采集完成: ${filtered.length} 条 (去重+过滤后)`);
  return filtered;
}

/** Mock 数据（API Key 未配置或余额不足时使用） */
function collectMockData(): CollectedPost[] {
  const mockPosts = [
    {
      title: "有没有好用的厨房收纳方案？台面永远乱糟糟",
      body: "家里厨房不大，调料瓶、锅具、小家电全堆在台面上，每次做饭都找不到东西。买过各种收纳盒但越收越乱，求推荐真正好用的厨房收纳方案。",
      author: "厨房小白",
    },
    {
      title: "辅导孩子写作业太崩溃了，有没有什么好办法？",
      body: "每天陪孩子写作业到9点多，讲三遍还是不懂，我控制不住吼他，吼完又后悔。有没有家长能轻松辅导的方法或者工具？",
      author: "焦虑的妈妈",
    },
    {
      title: "Excel公式太难学了，有没有不用公式就能自动出报表的工具？",
      body: "行政岗每周要做5张报表，全是复制粘贴。试过学VLOOKUP但实在学不会，有没有傻瓜式的报表工具？",
      author: "行政小王",
    },
    {
      title: "扫地机器人到底是不是智商税？想买但怕踩雷",
      body: "看了很多测评，有人说好有人说不好。家里有宠物毛发，想买个扫地机器人但又怕买回来积灰。有没有真正好用的推荐？",
      author: "纠结的消费者",
    },
    {
      title: "家庭记账App用了十几个都坚持不下来，怎么办？",
      body: "随手记、鲨鱼记账、喵喵记账都试过，最多坚持一周。主要问题是手动记太麻烦，有没有能自动记账的方案？",
      author: "糊涂账本",
    },
    {
      title: "上班族久坐腰疼，在家怎么简单锻炼？",
      body: "办了健身卡一年去了三次。在家想做简单运动但不知道做什么，Keep上的课程太多了选不出来。有没有适合上班族的15分钟锻炼方案？",
      author: "久坐党",
    },
  ];

  const now = Date.now();
  return mockPosts.map((m, i) => ({
    source: "zhihu" as const,
    external_id: `zhihu_mock_${i + 1}`,
    title: m.title,
    body: m.body,
    url: `https://zhihu.com/question/mock_${i + 1}`,
    author: m.author,
    score: Math.floor(Math.random() * 50) + 10,
    num_comments: Math.floor(Math.random() * 30) + 5,
    language: "zh",
    published_at: new Date(now - (i + 1) * 3600_000),
    comments: null,
    external_content: null,
  }));
}
