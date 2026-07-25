/**
 * 需求卡片抽取 — 面向生活/工作需求场景
 *
 * 将一条原始帖子交给 LLM, 产出结构化的需求卡片
 * 支持中文生活类需求（知乎/小红书/微博等）和英文需求（HN/Reddit）
 */

import { LLMClient } from "./llm-client";
import type { CollectedPost } from "@/lib/collectors/types";

/** System Prompt — 聚焦数字工具/软件应用需求 */
const SYSTEM_PROMPT = `你是一个需求分析专家,专注于发现「数字工具和软件应用领域的未被满足需求」。
你的任务是从互联网帖子中识别用户对App、软件、工具的痛点、需求和期望,
并将其结构化为一张需求卡片。

你擅长分析来自知乎、小红书、微博等中文社交平台以及HackerNews、Reddit等英文平台的帖子。

分析原则:
1. 重点关注以下需求信号(数字工具/软件方向优先):
   - 工具求助: "有没有好用的xxx App"、"求推荐xxx工具"、"有没有什么软件可以"
   - 工具吐槽: "xxx太难用了"、"这个App经常崩溃"、"功能太少了"
   - 替代品需求: "有没有xxx的替代品"、"比xxx更好的"、"不想用xxx了"
   - 功能缺失: "找不到能xxx的工具"、"为什么没有xxx功能"、"缺一个xxx"
   - 对比纠结: "xxx和xxx哪个好"、"该怎么选"、"纠结买不买"
   - 付费意愿: "愿意付费"、"太贵了"、"有没有免费的"
   - 通用需求信号: "求推荐"、"怎么办"、"踩坑"、"避雷"
2. 即使帖子很短(只有一句话),只要表达了上述信号,就应提取需求。
3. 如果帖子纯粹是情感宣泄、心灵鸡汤、新闻分享、没有指向任何具体问题或需求,返回 {"has_demand": false}。
4. pain_point 要根据帖子内容推断具体问题,可以适当合理推测。
5. desired_outcome 描述用户期望的结果,即使帖子没有明确说,也要根据上下文推断。
6. intensity 评分(1-10)参考:
   - 9-10: 强烈痛苦,明确表示"无法忍受"、"后悔用了"、"崩溃"
   - 7-8:  明确不满或强烈求助,有具体痛点
   - 5-6:  有不便但能忍受,或一般性求助
   - 3-4:  轻微提及
   - 1-2:  顺带提及
7. mentioned_tools 列出帖子中提到的具体产品/工具/服务/App名。
8. domain 使用以下5个领域分类:
   - 数字工具 (App推荐、软件工具、效率工具、AI工具、SaaS服务等 — 核心关注领域)
   - 消费购物 (实体商品选购、值不值、省钱攻略、财务管理等)
   - 生活居家 (搬家保洁、装修维修、整理收纳、生活服务等)
   - 职场发展 (求职面试、职业规划、工作效率、技能提升等)
   - 健康教育 (健康管理、教育育儿、社交关系、情绪管理等)
   如果不属于以上分类,可以自定义新的领域名称。
9. persona 描述目标人群,如"上班族"、"大学生"、"自由职业者"、"创业者"、"设计师"等。
10. 同时支持中文和英文帖子内容分析。
11. 特别注意: 当帖子涉及软件/App/工具/插件/扩展/网站/平台时,优先归类为"数字工具"。

输出 JSON 格式:
{
  "has_demand": true/false,
  "domain": "领域分类",
  "sub_domain": "子领域",
  "persona": "受众人群",
  "pain_point": "痛点描述(中文)",
  "desired_outcome": "用户期望的结果(中文)",
  "current_alternative": "当前使用的替代方案或工具",
  "evidence_type": "complaint | help_seeking | missing | comparison",
  "intensity": 1-10的整数,
  "mentioned_tools": ["工具1", "工具2"]
}`;

export interface ExtractedDemand {
  has_demand: boolean;
  domain: string;
  sub_domain: string;
  persona: string;
  pain_point: string;
  desired_outcome: string;
  current_alternative: string;
  evidence_type: string;
  intensity: number;
  mentioned_tools: string[];
}

/** 构造用户消息 */
function buildUserPrompt(post: CollectedPost): string {
  const parts: string[] = [];
  if (post.title) parts.push(`标题: ${post.title}`);
  if (post.body) parts.push(`正文: ${post.body.slice(0, 2000)}`);
  if (post.comments) parts.push(`评论区讨论:\n${post.comments.slice(0, 2000)}`);
  if (post.external_content) parts.push(`链接页面内容摘要:\n${post.external_content.slice(0, 2000)}`);
  if (post.author) parts.push(`作者: ${post.author}`);
  parts.push(`来源: ${post.source}`);
  parts.push(`投票数: ${post.score}  评论数: ${post.num_comments}`);
  return parts.join("\n");
}

export class DemandCardExtractor {
  private llm: LLMClient;

  constructor(llmClient?: LLMClient) {
    this.llm = llmClient || new LLMClient();
  }

  /** 抽取单条帖子的需求 */
  async extract(post: CollectedPost): Promise<ExtractedDemand | null> {
    const userPrompt = buildUserPrompt(post);

    let result: Record<string, any>;
    try {
      result = await this.llm.chatJson(SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      console.error(`[Extractor] LLM extract failed for ${post.external_id}:`, err);
      return null;
    }

    const demand: ExtractedDemand = {
      has_demand: result.has_demand ?? false,
      domain: result.domain || "",
      sub_domain: result.sub_domain || "",
      persona: result.persona || "",
      pain_point: result.pain_point || "",
      desired_outcome: result.desired_outcome || "",
      current_alternative: result.current_alternative || "",
      evidence_type: result.evidence_type || "complaint",
      intensity: parseInt(result.intensity) || 5,
      mentioned_tools: result.mentioned_tools || [],
    };

    if (!demand.has_demand) {
      return null;
    }

    console.log(
      `[Extractor] Extracted demand: [${demand.domain}/${demand.sub_domain}] intensity=${demand.intensity} from ${post.external_id}`
    );
    return demand;
  }

  /** 批量抽取 */
  async extractBatch(
    posts: CollectedPost[]
  ): Promise<Array<{ post: CollectedPost; demand: ExtractedDemand }>> {
    const results: Array<{ post: CollectedPost; demand: ExtractedDemand }> = [];
    for (const post of posts) {
      const demand = await this.extract(post);
      if (demand) {
        results.push({ post, demand });
      }
    }
    return results;
  }
}

/** 计算需求卡片的各项得分 */
export function computeScores(post: CollectedPost, demand: ExtractedDemand) {
  // 频次分
  const frequency_score = 1.0;

  // 时效性分: 30天内线性衰减
  let recency_score = 0.0;
  if (post.published_at) {
    const daysOld = Math.floor((Date.now() - post.published_at.getTime()) / (1000 * 60 * 60 * 24));
    recency_score = Math.max(0.0, 1.0 - daysOld / 30.0);
  }

  // 市场规模分
  const market_score = Math.min(1.0, post.score * 0.01 + post.num_comments * 0.005);

  // 竞争度分
  const tool_count = demand.mentioned_tools.length;
  const competition_score = Math.min(1.0, tool_count * 0.2);

  // 综合得分
  const overall =
    (demand.intensity * 0.35 +
      frequency_score * 0.15 +
      recency_score * 0.15 +
      market_score * 0.2 +
      (1.0 - competition_score) * 0.15) *
    10;

  return {
    frequencyScore: Math.round(frequency_score * 100) / 100,
    recencyScore: Math.round(recency_score * 100) / 100,
    marketScore: Math.round(market_score * 100) / 100,
    competitionScore: Math.round(competition_score * 100) / 100,
    overallScore: Math.round(overall * 10) / 10,
  };
}
