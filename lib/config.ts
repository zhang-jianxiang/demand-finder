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
  LLM_MODEL: process.env.LLM_MODEL || "deepseek-chat",

  // ─── HackerNews (保留，英文技术需求) ───
  HN_ALGOLIA_URL: process.env.HN_ALGOLIA_URL || "https://hn.algolia.com/api/v1",
  HN_SEARCH_KEYWORDS: process.env.HN_SEARCH_KEYWORDS || "",
  HN_MAX_RESULTS: parseInt(process.env.HN_MAX_RESULTS || "50"),

  // ─── TikHub API (核心数据源) ───
  TIKHUB_API_KEY: process.env.TIKHUB_API_KEY || "",
  TIKHUB_BASE_URL: process.env.TIKHUB_BASE_URL || "https://api.tikhub.io",

  // ─── Reddit (聚焦软件/工具类 Subreddit) ───
  REDDIT_SUBREDDITS: process.env.REDDIT_SUBREDDITS || "selfhosted,software,apps,productivity,webdev,programming,freesoftware,opensource,macapps,androidapps",

  // ─── 知乎 (聚焦软件/工具需求) ───
  ZHIHU_KEYWORDS: process.env.ZHIHU_KEYWORDS || "有没有好用的App,求推荐软件,有没有什么工具,免费替代,太贵了有没有替代,效率工具推荐,有没有开源的,好用的插件推荐",

  // ─── 小红书 (聚焦软件/工具需求) ───
  XHS_KEYWORDS: process.env.XHS_KEYWORDS || "好用的App推荐,效率工具分享,免费软件推荐,App避雷,软件踩坑,有没有好用的App,替代软件推荐,宝藏App,工具推荐,学生党App",

  // ─── 微博 (聚焦软件/工具需求) ───
  WEIBO_KEYWORDS: process.env.WEIBO_KEYWORDS || "App推荐,工具推荐,效率软件,免费工具,软件避雷,有没有好用的App",

  // ─── X/Twitter (英文需求信号，聚焦软件/工具/创业) ───
  TWITTER_KEYWORDS: process.env.TWITTER_KEYWORDS || "looking for an app,wish there was an app,is there a tool for,need a tool,alternative to,cheaper alternative,app recommendation,startup idea,pain point,frustrated with",

  // ─── 通用 ───
  LOG_LEVEL: process.env.LOG_LEVEL || "INFO",

  // ─── 派生属性 ───
  get subredditList() {
    return parseList(this.REDDIT_SUBREDDITS, []);
  },
  get zhihuKeywordList() {
    return parseList(this.ZHIHU_KEYWORDS, [
      "有没有好用的App", "求推荐软件", "有没有什么工具", "免费替代",
      "太贵了有没有替代", "效率工具推荐", "有没有开源的", "好用的插件推荐",
    ]);
  },
  get xhsKeywordList() {
    return parseList(this.XHS_KEYWORDS, [
      "好用的App推荐", "效率工具分享", "免费软件推荐", "App避雷",
      "软件踩坑", "有没有好用的App", "替代软件推荐", "宝藏App", "工具推荐", "学生党App",
    ]);
  },
  get weiboKeywordList() {
    return parseList(this.WEIBO_KEYWORDS, [
      "App推荐", "工具推荐", "效率软件", "免费工具", "软件避雷", "有没有好用的App",
    ]);
  },
  get twitterKeywordList() {
    return parseList(this.TWITTER_KEYWORDS, [
      "looking for an app", "wish there was an app", "is there a tool for",
      "need a tool", "alternative to", "cheaper alternative",
      "app recommendation", "startup idea", "pain point", "frustrated with",
    ]);
  },
  get hnKeywordList() {
    if (this.HN_SEARCH_KEYWORDS.trim()) {
      return parseList(this.HN_SEARCH_KEYWORDS, []);
    }
    // 英文需求信号关键词（聚焦软件/工具需求）
    return [
      "looking for a tool", "wish there was an app", "alternative to",
      "is there a tool", "open source alternative", "self-hosted",
      "cheaper alternative", "any recommendation for", "switching from",
    ];
  },
} as const;
