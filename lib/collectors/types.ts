/**
 * 采集器共享类型 — 面向生活/工作需求的多平台采集
 */

export type DataSourceType =
  | "hackernews"
  | "reddit"
  | "stackoverflow"
  | "zhihu"
  | "xiaohongshu"
  | "weibo"
  | "douyin"
  | "bilibili"
  | "twitter";

export interface CollectedPost {
  source: DataSourceType;
  external_id: string;
  title: string | null;
  body: string | null;
  url: string | null;
  author: string | null;
  score: number;
  num_comments: number;
  language: string;
  published_at: Date | null;
  // 富化字段
  comments: string | null;
  external_content: string | null;
}

/** 需求信号预过滤关键词（中英文混合） */
const DEMAND_KEYWORDS = [
  // 中文需求信号
  "有没有好用的", "求推荐", "太麻烦了", "怎么办", "有没有什么",
  "吐槽", "踩坑", "后悔", "智商税", "不值得", "避雷", "踩雷",
  "太难了", "买什么", "哪个好", "有没有用", "有用吗", "求助",
  "推荐一下", "种草", "拔草", "不好用", "太贵了", "便宜",
  "替代", "有没有替代", "有没有类似", "不如", "差评",
  // 英文需求信号（保留 HN/Reddit 英文内容兼容）
  "alternative", "looking for", "wish", "frustrated",
  "too expensive", "hate", "switching", "missing",
  "no tool", "is there", "any recommendation",
  "pain point", "struggling", "workaround",
  "paying for", "switch from", "better than",
  "cheaper", "need a tool", "is there something",
];

/** 判断帖子是否可能包含需求信号 */
export function isLikelyDemandSignal(post: CollectedPost): boolean {
  const text = `${post.title || ""} ${post.body || ""} ${post.comments || ""}`.toLowerCase();
  if (text.trim().length < 10) return false;
  return DEMAND_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

/** 去重 */
export function dedupPosts(posts: CollectedPost[]): CollectedPost[] {
  const seen = new Set<string>();
  const unique: CollectedPost[] = [];
  for (const post of posts) {
    if (!seen.has(post.external_id)) {
      seen.add(post.external_id);
      unique.push(post);
    }
  }
  return unique;
}
