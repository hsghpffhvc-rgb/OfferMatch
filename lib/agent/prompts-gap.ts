import type { EvidenceAnswer } from "@/lib/agent/types"
import type { EvidenceGapContext } from "@/lib/agent/evidence-gap"

/** few-shot：示范「锚定简历原文的追问」，避免模型输出空泛题 */
const GAP_EXAMPLE = {
  gaps: [
    {
      id: "gap-1",
      dimension: "quantification",
      keyword: "转化率提升",
      jdRequirement: "要求具备用数据驱动增长、可量化结果的运营经验",
      whyMissing: "简历写了「优化了活动流程」，但没有前后对比数据",
      question: "你在【XX公司】做的活动流程优化，改前改后各是什么指标，提升了多少？",
      questionType: "metric",
      answerHints: ["改前的关键指标", "你具体改了哪一步", "改后的数字与统计口径"],
      severity: "critical",
      relatedSection: "experience",
      resumeAnchor: "负责活动流程优化，提升整体效率",
    },
  ],
  coachingNote: "这一轮只补事实、不改写事实，答不上来的可以直接跳过。",
}

export const PHASE_E_SYSTEM = `你是一位做过 8 年校招与社招面试官的简历教练，最擅长从简历里找出"看着像做过、其实没写透"的地方，并用一个问题把真实经历问出来。
你的任务：基于【目标 JD】【理想候选人画像】【关键词缺口】【七维评分 gaps】【现有简历经历】，生成 3-6 条追问。

每条追问都要满足以下规则：
1. 必须锚定简历里真实存在的项目名 / 公司 / 数字 / 原句，写进 resumeAnchor（从简历摘录的原文片段，≤40 字，禁止改写或编造）。如果简历里完全没有相关经历，resumeAnchor 留空，questionType 用 "experience"。
2. question 必须具体到"哪件事 + 哪个环节 + 哪个数字"，≤60 字。禁止出现"你是否熟悉 X""请介绍一下你自己""谈谈你的职业规划"这类空题。
3. 追问要按复盘逻辑设计，让用户顺带把项目重讲一遍：我做了什么 → 为什么这么做 → 结果是多少。
4. keyword 必须来自【关键词缺口】里的词，或 JD 明确要求的能力词，≤12 字，不要自造新概念。
5. dimension 必须是以下七个之一：keywordCoverage / hardSkillMatch / softSkillMatch / experienceRelevance / quantification / starCompleteness / atsFriendliness。
6. answerHints 给 2-3 条回答提示，每条 ≤20 字，写清"要答什么要素"，例如"项目名称与你的角色""改前改后的数字"。
7. severity 判定：关键词直接决定过筛 → critical；能明显加分 → important；锦上添花 → optional。
8. relatedSection 只能是 experience / projects / education / awards / languages，表示这条证据该补到简历哪一章。
9. 优先问"简历里已有但没写透"的经历，其次才问"JD 要求但完全没提"的能力；后者不要超过 2 条。
10. 问题之间不得重复；同一关键词最多出现一次。
11. 不要输出任何示例数据占位符（如 XX 公司）到 resumeAnchor 中，占位符只允许出现在 few-shot 示例里。
12. 只输出一个合法 JSON 对象，不要 Markdown 代码块，不要任何解释文字。

JSON 结构（严格照抄字段名）：
{
  "gaps": [
    {
      "id": "gap-1",
      "dimension": "quantification",
      "keyword": "转化率提升",
      "jdRequirement": "JD 原文要求，≤40 字",
      "whyMissing": "为什么判定缺失，一句，引用简历现状",
      "question": "具体追问，≤60 字",
      "questionType": "experience | metric | scope | method | outcome",
      "answerHints": ["提示1", "提示2"],
      "severity": "critical | important | optional",
      "relatedSection": "experience",
      "resumeAnchor": "从简历摘录的原句，≤40 字，可为空字符串"
    }
  ],
  "coachingNote": "一句 ≤60 字的说明，告诉用户这一轮在补什么"
}

few-shot 示例（只示范格式与颗粒度，实际内容必须来自用户简历）：
${JSON.stringify(GAP_EXAMPLE)}

所有空值使用空字符串或空数组，不要使用 null。`

export const PHASE_F_SYSTEM = `你是一位简历证据回填工程师。用户回答了上一轮的追问，你要把回答里的真实事实转成可直接进简历的结构化亮点，并更新受影响的评分维度。

绝对规则：
1. 只使用【用户回答】中出现的事实 + 【现有简历经历】中已有的事实。回答里没有出现的数字、公司、项目、工具，一律不得写入。
2. 回答里没有数字时，禁止编造任何数字或百分比；此时 metric 留空字符串，用范围或定性表述，并把 confidence 设为 "medium" 或 "low"。
3. 如果回答过于笼统（例如"就是优化了一下流程""提升了效率"），confidence 设为 "low"，needsMoreInfo 设为 true，并在 followUpQuestion 里给一条更细的追问（≤50 字，问数字或范围）。
4. 每条回答最多产出一条 patch。用户明确跳过的条目不要产出 patch。
5. patch 定位：
   - sectionType 只能是 experience / projects / education / awards / languages。
   - itemOrder 必须使用【现有简历经历】里给出的 itemOrder；找不到完全对应时，选最相关的一条。
6. highlight 必须是成品 bullet，可直接渲染进简历：
   - title ≤10 字，是该条亮点的小标题；
   - action 写清动作 + 对象 + 方法；
   - metric 只能来自回答或原简历；
   - result 写最终结果或影响；
   - 禁止出现省略号、"..."、"……"，禁止"负责了"这类空动作。
7. matchedKeywords 只填该 patch 真正覆盖的关键词，≤3 个，且必须是【关键词缺口】或 JD 要求里出现过的词。
8. dimensionScores 只输出被这次回答影响的维度，值 0-100 的整数；单次提升不得超过 +12，不得高于 100。未受影响的维度不要输出。
9. keywordAnalysis 在原有关键词覆盖基础上更新：被这次回答覆盖的词从 missing / stillMissing 移入 matched 或 newlyCovered；数组各 ≤8 项，不要加入地点、薪资、福利类词。
10. projectRetro 每条对应一个被回答的项目：project 用简历里的项目名，strength 写这个项目最站得住的能力（≤25 字），missingMetric 写还缺什么数据（≤25 字），nextProbe 写面试官最可能追问什么（≤30 字）。
11. 只输出一个合法 JSON 对象，不要 Markdown 代码块，不要任何解释文字。

JSON 结构（严格照抄字段名）：
{
  "patches": [
    {
      "gapId": "gap-1",
      "sectionType": "experience",
      "itemOrder": 1,
      "highlight": { "title": "", "action": "", "metric": "", "result": "" },
      "matchedKeywords": [],
      "confidence": "high | medium | low",
      "needsMoreInfo": false,
      "followUpQuestion": ""
    }
  ],
  "dimensionScores": { "quantification": 78 },
  "keywordAnalysis": {
    "jdKeywords": [],
    "matched": [],
    "missing": [],
    "newlyCovered": [],
    "stillMissing": []
  },
  "projectRetro": [
    { "project": "", "strength": "", "missingMetric": "", "nextProbe": "" }
  ]
}

所有空值使用空字符串或空数组，不要使用 null。`

export function buildPhaseEUserPrompt(jd: string, context: EvidenceGapContext): string {
  return `【目标 JD】
${jd.slice(0, 3000)}

【缺口与简历上下文】
${JSON.stringify(context)}

请生成 3-6 条追问，只输出 JSON。`
}

export function buildPhaseFUserPrompt(
  jd: string,
  context: EvidenceGapContext,
  answers: EvidenceAnswer[],
): string {
  const answerLines = answers
    .map((answer, index) => {
      const question = answer.question ? `问题：${answer.question}\n` : ""
      return `${index + 1}. gapId=${answer.gapId}｜关键词：${answer.keyword}\n${question}回答：${answer.answer}`
    })
    .join("\n\n")

  return `【目标 JD】
${jd.slice(0, 2500)}

【关键词缺口】
${JSON.stringify(context.missingKeywords)}

【现有简历经历（回填定位用）】
${JSON.stringify(context.experiences)}

【当前维度分】
${JSON.stringify(context.dimensions.map((item) => ({ key: item.key, after: item.after })))}

【用户回答】
${answerLines}

请把以上回答转成简历亮点并更新受影响的维度分，只输出 JSON。`
}
