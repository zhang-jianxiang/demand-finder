/**
 * 小红书采集器 — 通过 TikHub API 搜索小红书笔记
 *
 * 端点: /api/v1/xiaohongshu/app_v2/search_notes
 *
 * 小红书是发现消费决策和生活需求的核心平台:
 * - "好物推荐" → 消费需求
 * - "避雷/踩雷" → 痛点信号
 * - "求推荐" → 求助型需求
 * - "种草/拔草" → 决策需求
 */

import { config } from "@/lib/config";
import { CollectedPost, dedupPosts } from "./types";

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
      console.warn("[小红书] TikHub 余额不足 (402)");
      return null;
    }
    if (resp.status === 403) {
      console.error("[小红书] TikHub API Key 缺少小红书权限 (403)");
      return null;
    }
    if (resp.status === 429) {
      console.warn("[小红书] TikHub 限流 (429)");
      await new Promise((r) => setTimeout(r, 5000));
      return null;
    }
    if (!resp.ok) {
      console.warn(`[小红书] TikHub 错误 ${resp.status}`);
      return null;
    }

    return resp.json();
  } catch (err) {
    console.error(`[小红书] TikHub 请求失败:`, err);
    return null;
  }
}

/** 解析小红书笔记 */
function parseNote(item: any): CollectedPost | null {
  try {
    // note 对象的字段是 id (不是 note_id)
    const id = item.note?.id || item.note?.note_id || item.note_id || item.id || "";
    if (!id) return null;

    const note = item.note || item.note_card || item;
    const title = note.title || note.display_title || note.desc?.substring(0, 50) || "";
    const body = note.desc || note.content || note.note_content || "";
    const author = note.user?.nickname || note.user?.name || item.user?.nickname || "";
    const interact = note.interact_info || {};
    const score = note.liked_count || note.like_count || interact.liked_count || interact.like_count || 0;
    const numComments = note.comment_count || interact.comment_count || 0;
    const url = `https://www.xiaohongshu.com/explore/${id}`;

    let publishedAt: Date = new Date();
    const created = note.time || note.create_time || note.last_update_time;
    if (created) {
      try {
        publishedAt = typeof created === "number"
          ? (created > 1e12 ? new Date(created) : new Date(created * 1000))
          : new Date(created);
      } catch { /* ignore */ }
    }

    return {
      source: "xiaohongshu",
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

/** 从搜索结果中提取笔记列表 */
function extractNotes(data: any, limit: number): CollectedPost[] {
  if (!data) return [];

  let items: any[] = [];
  try {
    // TikHub 包装: data.data (TikHub) -> data.data (小红书) -> items[]
    const root = data.data;
    const inner = root?.data;
    if (Array.isArray(inner?.data?.items)) {
      items = inner.data.items;
    } else if (Array.isArray(inner?.items)) {
      items = inner.items;
    } else if (Array.isArray(root?.data?.items)) {
      items = root.data.items;
    } else if (Array.isArray(root?.items)) {
      items = root.items;
    } else if (Array.isArray(root)) {
      items = root;
    }
  } catch {
    items = [];
  }

  const posts: CollectedPost[] = [];
  for (const item of items.slice(0, limit)) {
    const post = parseNote(item);
    if (post) posts.push(post);
  }
  return posts;
}

/** 主采集函数 */
export async function collectXiaohongshu(maxResults = 30): Promise<CollectedPost[]> {
  if (!config.TIKHUB_API_KEY) {
    console.warn("[小红书] TikHub API Key 未配置，使用 Mock 数据");
    return collectMockData();
  }

  const allPosts: CollectedPost[] = [];
  const keywords = config.xhsKeywordList.slice(0, 5);

  for (const keyword of keywords) {
    try {
      const data = await tikhubGet("/api/v1/xiaohongshu/app_v2/search_notes", {
        keyword: keyword,
        page: "1",
        sort_type: "",
        note_type: "",
        time_filter: "",
      });

      if (data) {
        const posts = extractNotes(data, 8);
        allPosts.push(...posts);
        console.log(`[小红书] 搜索 '${keyword}': ${posts.length} 条`);
      }
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[小红书] 搜索 '${keyword}' 失败:`, err);
    }
  }

  // 搜索关键词本身就是需求信号，跳过二次过滤，仅去重
  const filtered = dedupPosts(allPosts);
  console.log(`[小红书] 采集完成: ${filtered.length} 条 (去重+过滤后)`);
  return filtered;
}

/** Mock 数据 */
function collectMockData(): CollectedPost[] {
  const mockPosts = [
    {
      title: "厨房收纳好物推荐 | 小户型必备",
      body: "租的房子厨房超小，台面根本不够用。试了磁吸调料盒+挂杆组合，终于把台面清空了。但还是有锅具没地方放，求更好的方案。",
      author: "收纳控",
    },
    {
      title: "避雷！这个扫地机器人千万别买",
      body: "花了2000多买的扫地机器人，用了三个月就坏了。客服态度差，维修要自费。后悔死了，有没有真正耐用的推荐？",
      author: "踩雷用户",
    },
    {
      title: "有没有好用的婴儿用品清单？新手妈妈求推荐",
      body: "刚生完宝宝，什么都不知道。买了一堆东西发现很多用不上。有没有有经验的妈妈分享一下真正必需品？不想再花冤枉钱了。",
      author: "新手妈妈",
    },
    {
      title: "衣柜整理太难了，衣服多到爆炸",
      body: "换季整理衣柜简直是噩梦。衣服多到塞不下，找一件要翻半天。买了收纳箱还是乱。有没有什么好用的衣柜整理方案？",
      author: "购物狂",
    },
    {
      title: "上班族带饭太难坚持了，怎么办？",
      body: "想带饭省钱又健康，但每天下班太累不想做。周末备菜又怕不新鲜。有没有轻松带饭的方法？",
      author: "带饭失败者",
    },
    {
      title: "英语启蒙求推荐 | 不想报班太贵了",
      body: "一年两万的英语启蒙班太贵了。想在家自己教但不知道怎么开始。有没有低成本又有效的方法？宝宝3岁。",
      author: "精打细算妈妈",
    },
  ];

  const now = Date.now();
  return mockPosts.map((m, i) => ({
    source: "xiaohongshu" as const,
    external_id: `xhs_mock_${i + 1}`,
    title: m.title,
    body: m.body,
    url: `https://xiaohongshu.com/explore/mock_${i + 1}`,
    author: m.author,
    score: Math.floor(Math.random() * 500) + 50,
    num_comments: Math.floor(Math.random() * 100) + 10,
    language: "zh",
    published_at: new Date(now - (i + 1) * 3600_000),
    comments: null,
    external_content: null,
  }));
}
