/**
 * 网页正文提取器 — 对应 Python 的 collectors/web_scraper.py
 *
 * 用 cheerio 替代 BeautifulSoup, 抓取帖子外链的网页正文
 */

import * as cheerio from "cheerio";
import type { CollectedPost } from "./types";

const SKIP_DOMAINS = new Set([
"twitter.com", "x.com", "facebook.com", "instagram.com",
"youtube.com", "youtu.be", "tiktok.com", "linkedin.com",
"news.ycombinator.com",
"github.com",
"reddit.com", "old.reddit.com", "www.reddit.com",
"xiaohongshu.com", "www.xiaohongshu.com",  // API 已返回完整内容
"zhihu.com", "www.zhihu.com",              // API 已返回完整内容
"weibo.com", "www.weibo.com",              // API 已返回完整内容
"bilibili.com", "www.bilibili.com",
]);

const CONTENT_SELECTORS = [
  "article", "main", "[role='main']",
  ".post-content", ".article-body", ".entry-content",
];

const MAX_CONTENT_CHARS = 3000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT = 5;

/** 从 HTML 中提取主要正文文本 */
function extractMainText(html: string): string {
  const $ = cheerio.load(html);

  // 移除噪声标签
  $("script, style, nav, footer, header, aside, noscript").remove();

  // 尝试用语义化标签定位正文
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().trim();
      if (text.length > 100) {
        return cleanText(text);
      }
    }
  }

  // 退路:取所有 <p> 标签
  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) paragraphs.push(text);
  });

  if (paragraphs.length > 0) {
    return cleanText(paragraphs.join("\n"));
  }

  return "";
}

/** 清理文本 */
function cleanText(text: string): string {
  return text
    .replace(/&[a-zA-Z]+;/g, " ")      // HTML 实体
    .replace(/\n{3,}/g, "\n\n")         // 合并空行
    .replace(/[ \t]{2,}/g, " ")         // 合并空格
    .trim();
}

/** 批量抓取外链正文 */
export async function enrichPosts(posts: CollectedPost[]): Promise<number> {
  // 筛选需要抓取的帖子
  const toFetch = posts.filter((post) => {
    if (!post.url) return false;
    try {
      const domain = new URL(post.url).hostname.toLowerCase();
      return ![...SKIP_DOMAINS].some((d) => domain.endsWith(d));
    } catch {
      return false;
    }
  });

  if (toFetch.length === 0) {
    console.log("[WebScraper] No posts with scrappable URLs");
    return 0;
  }

  console.log(`[WebScraper] Fetching ${toFetch.length} external pages`);

  // 并发抓取（限制并发数）
  const semaphore = { count: 0, max: MAX_CONCURRENT };
  const queue = [...toFetch];

  const fetchOne = async (post: CollectedPost) => {
    // 简单的信号量控制
    while (semaphore.count >= semaphore.max) {
      await new Promise((r) => setTimeout(r, 100));
    }
    semaphore.count++;

    try {
      const resp = await fetch(post.url!, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FindDemandsBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!resp.ok) return;

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("xhtml")) return;

      const html = await resp.text();
      const text = extractMainText(html);
      if (text.length > 50) {
        post.external_content = text.slice(0, MAX_CONTENT_CHARS);
      }
    } catch {
      // 静默失败
    } finally {
      semaphore.count--;
    }
  };

  await Promise.allSettled(toFetch.map(fetchOne));

  const enriched = toFetch.filter((p) => p.external_content).length;
  console.log(`[WebScraper] ${enriched}/${toFetch.length} pages successfully scraped`);
  return enriched;
}
