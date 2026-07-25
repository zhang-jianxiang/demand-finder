/**
 * 集中式配置管理 — 从环境变量读取所有配置
 * 面向生活/工作需求发现，数据源以中文平台为主
 */

function parseList(val: string | undefined, fallback: string[] = []): string[] {
  if (!val || !val.trim()) return fallback;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export const config = {
  // ─── 数据库 ───
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/find_demands",

  // ─── LLM 配置 ───
  LLM_PROVIDER: process.env.LLM_PROVIDER || "deepseek",
  LLM_API_KEY: process.env.LLM_API_KEY || "",
  LLM_BASE_URL: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
  LLM_MODEL: process.env.LLM_MODEL || "deepseek-v4-flash",

  // ─── HackerNews (保留，英文技术需求) ───
  HN_ALGOLIA_URL: process.env.HN_ALGOLIA_URL || "https://hn.algolia.com/api/v1",
  HN_SEARCH_KEYWORDS: process.env.HN_SEARCH_KEYWORDS || "",
  HN_MAX_RESULTS: parseInt(process.env.HN_MAX_RESULTS || "50"),

  // ─── TikHub API (核心数据源) ───
  TIKHUB_API_KEY: process.env.TIKHUB_API_KEY || "",
  TIKHUB_BASE_URL: process.env.TIKHUB_BASE_URL || "https://api.tikhub.io",

  // ─── Reddit (生活/工作类 Subreddit) ───
  REDDIT_SUBREDDITS: process.env.REDDIT_SUBREDDITS || "LifeProTips,productivity,BuyItForLife,smallbusiness,Entrepreneur,finance,home,Parenting,Cooking,DIY",

  // ─── 知乎 ───
  ZHIHU_KEYWORDS: process.env.ZHIHU_KEYWORDS || "有没有好用的,求推荐,太麻烦了,怎么办,有没有什么办法,吐槽,踩坑,后悔买,智商税,不值得",

  // ─── 小红书 ───
  XHS_KEYWORDS: process.env.XHS_KEYWORDS || "好物推荐,避雷,踩雷,后悔,有没有,求推荐,太难了,怎么办,推荐一下,种草,拔草",

  // ─── 微博 ───
  WEIBO_KEYWORDS: process.env.WEIBO_KEYWORDS || "求助,推荐,吐槽,太难了,有没有,怎么办,买什么,哪个好",

  // ─── 通用 ───
  LOG_LEVEL: process.env.LOG_LEVEL || "INFO",

  // ─── 派生属性 ───
  get subredditList() {
    return parseList(this.REDDIT_SUBREDDITS, []);
  },
  get zhihuKeywordList() {
    return parseList(this.ZHIHU_KEYWORDS, [
      "有没有好用的", "求推荐", "太麻烦了", "怎么办",
      "有没有什么办法", "吐槽", "踩坑", "后悔买", "智商税", "不值得",
    ]);
  },
  get xhsKeywordList() {
    return parseList(this.XHS_KEYWORDS, [
      "好物推荐", "避雷", "踩雷", "后悔", "有没有",
      "求推荐", "太难了", "怎么办", "种草", "拔草",
    ]);
  },
  get weiboKeywordList() {
    return parseList(this.WEIBO_KEYWORDS, [
      "求助", "推荐", "吐槽", "太难了", "有没有", "怎么办",
    ]);
  },
  get hnKeywordList() {
    if (this.HN_SEARCH_KEYWORDS.trim()) {
      return parseList(this.HN_SEARCH_KEYWORDS, []);
    }
    // 英文需求信号关键词（保留 HN 作为补充源）
    return [
      "looking for", "wish there was", "frustrated with",
      "too expensive", "is there a tool", "any recommendation",
      "struggling with", "cheaper alternative",
    ];
  },
} as const;
