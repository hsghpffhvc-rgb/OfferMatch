import type { KeywordAnalysis, RewriteResult } from "@/lib/agent/types"

/**
 * 雇主侧 / 非简历能力词：不应进入「缺失关键词」交叉比对。
 * 作为 Prompt 约束的兜底过滤，避免地点、福利等污染结果。
 */
const EMPLOYER_SIDE_KEYWORD_PATTERN =
  /光谷|高新区|开发区|产业园|写字楼|远程|驻场|坐班|双休|单休|大小周|朝九晚|不加班|加班|五险一金|六险一金|社保|公积金|年终奖|十三薪|十四薪|底薪|提成|期权|股票|餐补|房补|交通补|话补|带薪|年假|病假|入职|到岗|转正|正编|外包|派遣|实习薪|薪资|待遇|福利|包住|包吃|通勤|地铁|公交|地址|办公地点|工作地点|工作城市|base地|Base/

/** 明显像城市/区县地名的短词（含常见后缀） */
const LOCATION_LIKE_PATTERN =
  /^(北京|上海|广州|深圳|杭州|南京|武汉|成都|重庆|西安|苏州|天津|长沙|郑州|青岛|大连|厦门|合肥|福州|济南|沈阳|哈尔滨|长春|昆明|南昌|贵阳|海口|三亚|宁波|无锡|东莞|佛山|珠海).{0,6}$|.*(市|区|县|镇|街道)$/

function isEmployerSideKeyword(keyword: string): boolean {
  const text = keyword.replace(/\s+/g, "").trim()
  if (!text) return true
  if (EMPLOYER_SIDE_KEYWORD_PATTERN.test(text)) return true
  if (LOCATION_LIKE_PATTERN.test(text)) return true
  return false
}

function filterKeywords(keywords: string[] | undefined): string[] {
  if (!Array.isArray(keywords)) return []
  return keywords.filter((item) => typeof item === "string" && !isEmployerSideKeyword(item))
}

/** 清洗 keywordAnalysis，去掉地点/福利等非简历能力词 */
export function sanitizeKeywordAnalysis(analysis: KeywordAnalysis): KeywordAnalysis {
  return {
    jdKeywords: filterKeywords(analysis.jdKeywords),
    matched: filterKeywords(analysis.matched),
    missing: filterKeywords(analysis.missing),
    newlyCovered: filterKeywords(analysis.newlyCovered),
    stillMissing: filterKeywords(analysis.stillMissing),
  }
}

/** 对阶段 C 重写结果做关键词字段兜底清洗 */
export function sanitizeRewriteResult(rewrite: RewriteResult): RewriteResult {
  if (!rewrite?.scores?.keywordAnalysis) return rewrite
  return {
    ...rewrite,
    scores: {
      ...rewrite.scores,
      keywordAnalysis: sanitizeKeywordAnalysis(rewrite.scores.keywordAnalysis),
    },
  }
}
