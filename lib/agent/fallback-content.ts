import type {
  EvidenceGapResult,
  EvidenceRefineResult,
  InterviewResult,
  OutlineResult,
  PersonaResult,
  RewriteResult,
} from "@/lib/agent/types"

/** 各阶段 LLM 失败时的预置示例数据（结构合法，供前端降级展示） */

export const FALLBACK_PERSONA: PersonaResult = {
  source: "fallback",
  title: "目标岗位候选人（示例）",
  industry: "互联网 / 科技",
  hardSkills: ["业务分析", "项目推进", "数据分析", "跨部门协作"],
  softSkills: ["沟通表达", "问题解决", "抗压能力", "学习能力"],
  businessPainPoints: [
    "需要更快验证业务假设",
    "跨团队信息不对称",
    "结果可量化程度不足",
  ],
  interviewKeywords: ["业务理解", "落地能力", "结果导向", "协作推进"],
  optimizationAdvice: [
    "在经历中补充可核验的量化结果",
    "用 STAR 完整叙述关键项目",
    "把 JD 关键词自然写入职责与成果",
  ],
}

export const FALLBACK_OUTLINE: OutlineResult = {
  source: "fallback",
  summary:
    "示例大纲：突出与目标岗位相关的业务理解、关键项目推进与可量化成果，便于 ATS 与面试官快速抓住匹配点。",
  sections: [
    {
      heading: "个人优势",
      bullets: [
        "具备目标岗位所需的核心技能与业务语境",
        "能用数据和案例说明个人贡献边界",
        "具备跨团队协作与闭环交付经验",
      ],
    },
    {
      heading: "关键经历",
      bullets: [
        "选择 1-2 段与 JD 最相关的经历展开",
        "每段包含背景、行动、结果与可复用方法",
        "优先写可验证指标与业务影响",
      ],
    },
    {
      heading: "技能与工具",
      bullets: [
        "列出与岗位硬技能对齐的工具与方法",
        "补充能支撑案例的软技能表达",
      ],
    },
  ],
  keyHighlights: [
    "结果可量化",
    "关键词对齐 JD",
    "STAR 结构完整",
  ],
}

export const FALLBACK_REWRITE: RewriteResult = {
  source: "fallback",
  scores: {
    keywordCoverage: {
      before: 42,
      after: 78,
      gaps: ["部分 JD 关键词尚未覆盖"],
      improvements: ["示例数据已补充常见岗位关键词"],
    },
    hardSkillMatch: {
      before: 48,
      after: 80,
      gaps: ["硬技能证据偏少"],
      improvements: ["示例中补充了可迁移的技能表达"],
    },
    softSkillMatch: {
      before: 55,
      after: 76,
      gaps: ["协作与影响力表述不足"],
      improvements: ["示例中增加了协作推进描述"],
    },
    experienceRelevance: {
      before: 50,
      after: 82,
      gaps: ["经历与岗位关联不够直接"],
      improvements: ["示例按岗位语境重组经历"],
    },
    quantification: {
      before: 40,
      after: 74,
      gaps: ["缺少明确数字"],
      improvements: ["示例补充了示意性指标"],
    },
    starCompleteness: {
      before: 45,
      after: 79,
      gaps: ["情境与结果不完整"],
      improvements: ["示例按 STAR 补全叙述"],
    },
    atsFriendliness: {
      before: 58,
      after: 85,
      gaps: ["结构不利于检索"],
      improvements: ["示例采用清晰分段与关键词"],
    },
    overallBefore: 48,
    overallAfter: 79,
    label: "示例匹配（AI 暂不可用）",
    keywordAnalysis: {
      jdKeywords: ["业务理解", "项目推进", "数据分析", "跨部门协作"],
      matched: ["业务理解", "项目推进"],
      missing: ["数据分析", "跨部门协作"],
      newlyCovered: ["数据分析", "跨部门协作"],
      stillMissing: [],
    },
    strengths: ["示例展示了清晰的岗位对齐写法", "量化与 STAR 结构较完整"],
    weaknesses: ["当前为预置示例，非基于你的真实简历"],
    actionItems: ["待 AI 恢复后重新生成个性化结果", "先用示例学习简历优化结构"],
  },
  resume: {
    basics: {
      name: "示例候选人",
      title: "目标岗位 · 示例简历",
      email: "example@offermatch.app",
      phone: "13800000000",
      location: "一线城市",
      linkedin: "",
      github: "",
      website: "",
      photo: "",
    },
    summary: {
      text: "具备与目标岗位相关的业务理解与落地推进能力，善于用数据与案例说明贡献。本页为 AI 暂不可用时的示例简历，供参考结构与表达方式。",
      positioning: "结果导向的业务型候选人",
      yearsExperience: 3,
      keywords: ["业务理解", "项目推进", "数据分析", "跨部门协作"],
    },
    sections: [
      {
        type: "experience",
        title: "工作经历",
        items: [
          {
            role: "业务 / 产品相关岗位",
            company: "示例公司",
            location: "城市",
            date: { start: "2022.01", end: "至今" },
            summary: "负责与目标岗位高度相关的业务推进与落地。",
            highlights: [
              {
                title: "关键项目",
                action: "梳理目标与约束，拆解任务并推动跨团队执行",
                metric: "周期缩短约 20%",
                result: "形成可复用的推进方法，并沉淀复盘机制",
              },
            ],
            keywords: ["项目推进", "跨部门协作"],
          },
        ],
      },
      {
        type: "skills",
        title: "技能",
        items: [
          {
            name: "数据分析",
            title: "数据分析",
            summary: "能用基础分析方法支撑业务决策",
          },
        ],
      },
    ],
    skills: [
      {
        group: "核心能力",
        items: [
          {
            name: "业务理解",
            category: "硬技能",
            level: "熟练",
            evidence: "示例项目中的目标拆解与结果验证",
          },
          {
            name: "沟通协作",
            category: "软技能",
            level: "熟练",
            evidence: "跨团队对齐与推动落地",
          },
        ],
      },
    ],
  },
  rewrittenResumeMarkdown: `# 示例候选人｜目标岗位 · 示例简历

> AI 暂时不可用，以下为结构示例，便于你了解优化后的简历写法。

## 个人总结
具备与目标岗位相关的业务理解与落地推进能力，善于用数据与案例说明贡献。

## 工作经历
### 业务 / 产品相关岗位 · 示例公司（2022.01 - 至今）
- 梳理目标与约束，拆解任务并推动跨团队执行，周期缩短约 20%
- 形成可复用的推进方法，并沉淀复盘机制

## 技能
- 业务理解、项目推进、数据分析、跨部门协作
`,
  modifications: [
    {
      section: "个人总结",
      original: "（原简历摘要）",
      rewritten: "突出岗位关键词与结果导向表达（示例）",
      rationale: "示例数据：展示如何把 JD 能力词写入摘要",
      matchedKeywords: ["业务理解", "结果导向"],
    },
    {
      section: "工作经历",
      original: "（原经历描述）",
      rewritten: "按 STAR 补全行动与量化结果（示例）",
      rationale: "示例数据：展示可核验的成果写法",
      matchedKeywords: ["项目推进", "数据分析"],
    },
  ],
}

export const FALLBACK_INTERVIEW: InterviewResult = {
  source: "fallback",
  questions: [
    {
      id: "sample-fallback-001",
      category: "resume_deep_dive",
      difficulty: "medium",
      question: "请具体说明你在最近一段经历中的个人职责和关键贡献。",
      intent: "确认职责边界、真实贡献和结果意识",
      personalizedBridge: "用你【相关经历】的真实数据替换示范中的数字与场景",
      answerStrategy: "S：交代背景与目标；T：明确职责；A：讲关键行动；R：用结果收束",
      referenceAnswer:
        "我想结合最近一段相关经历来说明。当时团队目标是推进与岗位相关的业务结果，我负责关键推进与落地。" +
        "具体行动上，我会先对齐目标与约束，再拆分任务、推动执行，并定期复盘偏差。" +
        "最终我们拿到了可核验的结果，我也沉淀了可复用的方法。回答时请替换为你简历里的真实数字与场景。",
    },
    {
      id: "sample-fallback-002",
      category: "behavioral",
      difficulty: "medium",
      question: "描述一次你在资源受限下做出关键取舍的经历。",
      intent: "考察问题分析、决策过程与复盘能力",
      personalizedBridge: "用你真实的限制条件与取舍替换上述示范细节",
      answerStrategy: "S：讲清限制；T：定义决策目标；A：对比方案；R：给结果与改进",
      referenceAnswer:
        "我印象最深的是一次资源或时间受限下的取舍。我先把目标拆成必须达成项与可延后项，再比较方案成本与风险。" +
        "最终选择了更利于结果的路径，并跟踪验证。复盘时我会说明如果重来会提前补齐哪类信息。" +
        "这是示例话术，请换成你自己的事实，不要编造数字。",
    },
    {
      id: "sample-fallback-003",
      category: "job_fit",
      difficulty: "medium",
      question: "请结合真实经历，说明你如何运用核心能力解决岗位相关问题。",
      intent: "验证核心能力是否有真实场景支撑",
      personalizedBridge: "用你的真实案例证明核心能力如何落地",
      answerStrategy: "S：先给能力结论；T：点出业务问题；A：讲方法；R：回扣岗位",
      referenceAnswer:
        "我认为核心能力不是概念，而是解决业务问题的工具。我会先判断问题本质，再选择合适方法推进，并说明个人贡献边界。" +
        "结果上给出可核对的变化，并说明对目标岗位的迁移价值。" +
        "请在面试前准备一个可讲 90 秒的完整案例。",
    },
  ],
  preparationChecklist: [
    "核对职责、时间与结果数字",
    "准备关键决策的替代方案",
    "梳理技能对应的真实案例",
  ],
}

export function getFallbackPersona(): PersonaResult {
  return { ...FALLBACK_PERSONA, source: "fallback" }
}

export function getFallbackOutline(): OutlineResult {
  return { ...FALLBACK_OUTLINE, source: "fallback" }
}

/**
 * 重写兜底：只返回一份"待完善草稿"标记，不再把原始简历塞进 summary/sections/skills，
 * 也不再生成"原始简历内容""目标岗位关键词"这类会污染投递正文的内容。
 * 调用方应把 rewrite 视为 null 并提示重试；此对象仅用于让 UI 显示校验状态。
 */
export function getFallbackRewrite(
  resumeText = "",
  outline?: OutlineResult,
): RewriteResult {
  const fallback: RewriteResult = {
    ...FALLBACK_REWRITE,
    source: "fallback",
    scores: {
      ...FALLBACK_REWRITE.scores,
      keywordAnalysis: { ...FALLBACK_REWRITE.scores.keywordAnalysis },
    },
    resume: {
      basics: { name: "", title: outline?.summary ?? "", email: "", phone: "", location: "", linkedin: "", github: "", website: "", photo: "" },
      summary: { text: "", positioning: "", yearsExperience: 0, keywords: [] },
      sections: [],
      skills: [],
    },
    rewrittenResumeMarkdown: "",
    modifications: [],
    analysis: { requirements: [], gaps: [] },
    verification: {
      status: "draft",
      truncated: false,
      issues: [
        {
          code: "PARSE_INCOMPLETE",
          message: resumeText.trim()
            ? "当前没有可用的重写结果，请点击重新执行重写"
            : "尚未提供简历内容，无法生成正式成稿",
          severity: "error",
          autoFixed: false,
        },
      ],
      pending: ["等待模型返回完整重写结果"],
    },
  }

  return fallback
}

export function getFallbackInterview(): InterviewResult {
  return {
    ...FALLBACK_INTERVIEW,
    source: "fallback",
    questions: FALLBACK_INTERVIEW.questions.map((q) => ({ ...q })),
    preparationChecklist: [...FALLBACK_INTERVIEW.preparationChecklist],
  }
}

export const FALLBACK_EVIDENCE_GAPS: EvidenceGapResult = {
  source: "fallback",
  coachingNote: "这一轮只补事实、不改写事实，答不上来的可以直接跳过。",
  gaps: [
    {
      id: "sample-gap-001",
      dimension: "quantification",
      keyword: "数据结果",
      jdRequirement: "要求用可量化结果说明个人贡献",
      whyMissing: "示例简历里的项目描述缺少前后对比数据",
      question: "你最想放大的那个项目，改前和改后各是什么指标，差距有多大？",
      questionType: "metric",
      answerHints: ["改前的基线数字", "你负责的那一步", "改后结果与统计口径"],
      severity: "critical",
      relatedSection: "projects",
      resumeAnchor: "",
    },
    {
      id: "sample-gap-002",
      dimension: "experienceRelevance",
      keyword: "协作推进",
      jdRequirement: "要求跨团队协作与项目推进经验",
      whyMissing: "示例简历只写了自己负责的模块，没有体现协作范围",
      question: "你推进项目时对接了哪些角色，出现分歧时你具体做了什么？",
      questionType: "method",
      answerHints: ["对接的角色与人数", "分歧的具体场景", "你怎么推动达成一致"],
      severity: "important",
      relatedSection: "experience",
      resumeAnchor: "",
    },
    {
      id: "sample-gap-003",
      dimension: "starCompleteness",
      keyword: "复盘迭代",
      jdRequirement: "要求具备复盘与持续迭代意识",
      whyMissing: "示例简历没有写上线后的验证与迭代动作",
      question: "项目上线后你用什么数据判断有效，后续又改了哪一版？",
      questionType: "outcome",
      answerHints: ["上线后的验证指标", "发现的问题", "第二版改了什么"],
      severity: "optional",
      relatedSection: "projects",
      resumeAnchor: "",
    },
  ],
}

export function getFallbackEvidenceGaps(): EvidenceGapResult {
  return {
    ...FALLBACK_EVIDENCE_GAPS,
    source: "fallback",
    gaps: FALLBACK_EVIDENCE_GAPS.gaps.map((gap) => ({
      ...gap,
      answerHints: [...gap.answerHints],
    })),
  }
}

export const FALLBACK_EVIDENCE_REFINE: EvidenceRefineResult = {
  source: "fallback",
  patches: [
    {
      gapId: "sample-gap-001",
      sectionType: "projects",
      itemOrder: 1,
      highlight: {
        title: "结果可量化",
        action: "针对关键环节做对比实验并沉淀口径统一的基线数据",
        metric: "",
        result: "结果指标较改前有明确提升（请替换为你的真实数字）",
      },
      matchedKeywords: ["数据结果"],
      confidence: "low",
      needsMoreInfo: true,
      followUpQuestion: "请补充改前与改后的具体数字和统计口径。",
    },
  ],
  dimensionScores: {},
  keywordAnalysis: {
    jdKeywords: [],
    matched: [],
    missing: [],
    newlyCovered: [],
    stillMissing: [],
  },
  projectRetro: [
    {
      project: "示例项目",
      strength: "能讲清关键动作与方法",
      missingMetric: "缺前后对比数字",
      nextProbe: "改前的基线是多少？",
    },
  ],
}

export function getFallbackEvidenceRefine(): EvidenceRefineResult {
  return {
    ...FALLBACK_EVIDENCE_REFINE,
    source: "fallback",
    patches: FALLBACK_EVIDENCE_REFINE.patches.map((patch) => ({
      ...patch,
      highlight: { ...patch.highlight },
      matchedKeywords: [...patch.matchedKeywords],
    })),
    dimensionScores: {},
    keywordAnalysis: {
      jdKeywords: [],
      matched: [],
      missing: [],
      newlyCovered: [],
      stillMissing: [],
    },
    projectRetro: FALLBACK_EVIDENCE_REFINE.projectRetro.map((item) => ({ ...item })),
  }
}
