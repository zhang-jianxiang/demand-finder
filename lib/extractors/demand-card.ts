/**
 * 需求卡片抽取 — 面向生活/工作需求场景
 *
 * 将一条原始帖子交给 LLM, 产出结构化的需求卡片
 * 支持中文生活类需求（知乎/小红书/微博等）和英文需求（HN/Reddit）
 */

import { LLMClient } from "./llm-client";
import type { CollectedPost } from "@/lib/collectors/types";

/** System Prompt — 面向生活/工作需求 */
const SYSTEM_PROMPT = `你是一个生活与工作需求分析专家。你的任务是从互联网帖子中识别「未被满足的真实需求」,
并将其结构化为一张需求卡片。

你擅长分析来自知乎、小红书、微博等中文社交平台的帖子,这些帖子可能很短(只有一两句话或几个标签),
但只要包含以下任何一种信号,就应当提取需求:

分析原则:
1. 需求信号包括(不限于此):
   - 求助/求推荐: "有没有好用的xxx"、"求推荐"、"怎么办"、"求助"、"有没有什么办法"
   - 抱怨/吐槽: "太麻烦了"、"太难了"、"踩坑"、"智商税"、"不值得"
   - 消费决策: "后悔买了"、"千万别买"、"避雷"、"买什么"、"哪个好"
   - 功能缺失: "找不到"、"没有"、"缺少"
   - 对比不满: "不如"、"太贵了"、"有没有替代"
   - 标签信号: #在线求助 #求推荐 #避雷 #踩坑 等
2. 即使帖子很短(只有一句话),只要表达了上述信号,就应提取需求。
3. 如果帖子纯粹是情感宣泄、心灵鸡汤、新闻分享、没有指向任何具体问题或需求,返回 {"has_demand": false}。
4. pain_point 要根据帖子内容推断具体问题,可以适当合理推测。
5. desired_outcome 描述用户期望的结果,即使帖子没有明确说,也要根据上下文推断。
6. intensity 评分(1-10)参考:
   - 9-10: 强烈痛苦,明确表示"无法忍受"、"后悔买了"、"崩溃"
   - 7-8:  明确不满或强烈求助,有具体痛点
   - 5-6:  有不便但能忍受,或一般性求助
   - 3-4:  轻微提及
   - 1-2:  顺带提及
7. mentioned_tools 列出帖子中提到的具体产品/工具/服务/App名。
8. domain 使用以下生活/工作领域分类:
   - 家居收纳 (厨房整理、衣柜整理、家装改造等)
   - 育儿教育 (作业辅导、英语启蒙、早教等)
   - 职场效率 (报表制作、会议记录、时间管理等)
   - 消费决策 (家电选购、母婴用品、数码产品等)
   - 健康管理 (健身锻炼、饮食营养、睡眠管理等)
   - 财务管理 (家庭记账、理财投资、省钱攻略等)
   - 生活服务 (搬家、保洁、维修等)
   - 社交关系 (亲子关系、职场人际等)
   - 数字工具 (App推荐、软件工具等)
   - 就业职场 (求职、面试、职业规划等)
   如果不属于以上分类,可以自定义新的领域名称。
9. persona 描述目标人群,如"家庭主妇"、"上班族"、"新手妈妈"、"自由职业者"、"大学生"等。
10. 同时支持中文和英文帖子内容分析。

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
