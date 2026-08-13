import type { InterviewContext } from "@/lib/agent/interview-context"
import type {
  InterviewCategory,
  InterviewQuestion,
  InterviewResult,
} from "@/lib/agent/types"

/** 静态题库：每类至少 3 道，供校验与模型失败时抽样 */
const INTERVIEW_QUESTION_BANK: InterviewQuestion[] = [
  // resume_deep_dive
  {
    id: "bank-rdd-001",
    category: "resume_deep_dive",
    difficulty: "medium",
    question: "请具体说明你在最近一段经历中的个人职责和关键贡献。",
    intent: "确认职责边界、真实贡献和结果意识",
    personalizedBridge: "用你【相关经历】的真实数据替换示范中的数字与场景",
    answerStrategy: "S：交代背景与目标；T：明确职责；A：讲关键行动；R：用结果收束",
    referenceAnswer:
      "我想结合最近一段相关经历来说明。当时团队目标是推进业务结果，我负责关键推进与落地，而不是旁观协调。" +
      "具体行动上，我会先对齐目标与约束，再拆分任务、推动执行，并定期复盘偏差。" +
      "最终我们拿到了可核验的结果，我也沉淀了可复用的方法。请替换为你简历里的真实数字与场景。",
  },
  {
    id: "bank-rdd-002",
    category: "resume_deep_dive",
    difficulty: "hard",
    question: "回顾某段关键经历，最大的挑战是什么，你如何做出取舍？",
    intent: "考察问题分析、决策过程与复盘能力",
    personalizedBridge: "用你【相关经历】的真实限制与取舍替换示范细节",
    answerStrategy: "S：讲清限制条件；T：定义决策目标；A：对比方案；R：给结果与改进",
    referenceAnswer:
      "我印象最深的是一次资源或时间受限下的关键取舍。当时如果平均发力，结果会稀释。" +
      "我先把目标拆成必须达成项与可延后项，再比较备选方案的成本与风险。" +
      "最终选择了更利于结果的路径并跟踪验证。复盘时说明如果重来会提前补齐哪类信息。",
  },
  {
    id: "bank-rdd-003",
    category: "resume_deep_dive",
    difficulty: "easy",
    question: "你简历中最能代表个人贡献的一个成果是什么？",
    intent: "快速验证成果真实性与表达清晰度",
    personalizedBridge: "用你【相关经历】中最硬的成果数字替换示范",
    answerStrategy: "S：一句话点题；T：交代目标；A：讲你的动作；R：给可核验结果",
    referenceAnswer:
      "我认为最能代表个人贡献的是某次关键交付。目标明确后，我负责推进关键环节并协调资源。" +
      "行动上我会说明自己做了什么、为什么这样做、如何验证。" +
      "结果用可核对的变化收束，并说明可复用之处。请换成你自己的真实案例。",
  },
  // technical
  {
    id: "bank-tech-001",
    category: "technical",
    difficulty: "medium",
    question: "请用一个真实项目说明你如何运用核心专业能力解决问题。",
    intent: "验证专业能力是否有场景支撑",
    personalizedBridge: "用你【相关经历】证明核心专业能力如何落地",
    answerStrategy: "S：先给能力结论；T：点出问题；A：讲方法与贡献；R：回扣岗位",
    referenceAnswer:
      "我认为专业能力是解决业务问题的工具。结合某次真实项目，当时问题与岗位要求高度相关。" +
      "我先判断问题本质，再选择合适方法推进，并说明为什么选这个方法、如何验证、以及个人贡献边界。" +
      "结果给出可核对的变化，并说明迁移价值。",
  },
  {
    id: "bank-tech-002",
    category: "technical",
    difficulty: "hard",
    question: "如果方案在中途失效，你如何定位原因并调整？",
    intent: "考察排查思路与技术/业务判断力",
    personalizedBridge: "用你真实的一次方案调整经历替换示范",
    answerStrategy: "S：说明失效现象；T：定义排查目标；A：分层定位；R：给出调整结果",
    referenceAnswer:
      "我会先区分是目标变了、约束变了，还是执行偏差。然后按影响面从大到小排查假设。" +
      "每一步用可观察信号验证，而不是凭感觉改方案。" +
      "调整后我会同步干系人，并沉淀避免同类问题的检查项。",
  },
  {
    id: "bank-tech-003",
    category: "technical",
    difficulty: "easy",
    question: "你日常如何保证交付质量与进度？",
    intent: "了解工作方法与质量意识",
    personalizedBridge: "用你真实的质量门禁或节奏管理做法替换",
    answerStrategy: "S：说明原则；T：对应项目约束；A：讲检查点；R：给效果",
    referenceAnswer:
      "我通常把质量拆成可检查的节点：需求对齐、关键路径验证、交付前复盘。" +
      "进度上用里程碑与风险提前暴露，而不是临近截止日期才升级。" +
      "请结合你简历中的真实节奏管理案例来讲。",
  },
  // behavioral
  {
    id: "bank-beh-001",
    category: "behavioral",
    difficulty: "medium",
    question: "描述一次跨团队协作中出现分歧，你如何推动达成一致。",
    intent: "考察沟通、协调与影响力",
    personalizedBridge: "用你真实的跨团队分歧案例替换示范",
    answerStrategy: "S：说明分歧背景；T：明确共同目标；A：讲对齐动作；R：给结果",
    referenceAnswer:
      "当时两边对优先级理解不一致。我先把共同目标写清楚，再分别澄清约束与风险。" +
      "用事实和影响面推动取舍，而不是站队。" +
      "最终形成可执行共识，并约定复盘节点。请换成你的真实协作场景。",
  },
  {
    id: "bank-beh-002",
    category: "behavioral",
    difficulty: "hard",
    question: "讲一次你主动承担责任、推动不确定事项落地的经历。",
    intent: "考察主人翁意识与抗压推进",
    personalizedBridge: "用你主动扛事的真实经历替换",
    answerStrategy: "S：讲清不确定性；T：定义你要达成什么；A：讲推进步骤；R：给结果",
    referenceAnswer:
      "面对信息不完整的事项，我先补齐最小必要信息，明确决策人与截止时间。" +
      "然后拆成可推进的小步，持续同步进度与风险。" +
      "最终把事项闭环，并说明自己学到的判断标准。",
  },
  {
    id: "bank-beh-003",
    category: "behavioral",
    difficulty: "easy",
    question: "你如何处理来自上级或同事的负面反馈？",
    intent: "考察开放度与改进能力",
    personalizedBridge: "用一次真实反馈改进经历替换",
    answerStrategy: "S：说明反馈内容；T：确认改进目标；A：讲行动；R：给变化",
    referenceAnswer:
      "我会先确认反馈具体指向的行为与影响，而不是立刻辩解。" +
      "然后制定可观察的改进动作，并在后续主动同步进展。" +
      "请用你真实改过的一次反馈来回答。",
  },
  // job_fit
  {
    id: "bank-fit-001",
    category: "job_fit",
    difficulty: "medium",
    question: "你为什么认为自己适合这个岗位？请用经历证明。",
    intent: "验证动机与能力匹配",
    personalizedBridge: "把示范中的能力点替换成你与 JD 对齐的证据",
    answerStrategy: "S：给匹配结论；T：点出岗位要求；A：用经历证明；R：回扣价值",
    referenceAnswer:
      "我认为匹配点主要有三：业务理解、推进落地、结果意识。" +
      "结合简历中的相关经历，我能说明自己如何在相似场景里创造结果。" +
      "这也是我能快速为团队贡献的原因。请用你的真实证据替换。",
  },
  {
    id: "bank-fit-002",
    category: "job_fit",
    difficulty: "hard",
    question: "如果入职后前 90 天，你会如何建立贡献？",
    intent: "考察岗位理解与落地规划",
    personalizedBridge: "按目标岗位的真实业务语境改写 90 天计划",
    answerStrategy: "S：说明原则；T：拆 30/60/90；A：讲动作；R：定义成功标准",
    referenceAnswer:
      "前 30 天我会对齐目标、系统与关键人；60 天内交付一个可感知的小闭环；90 天形成稳定产出节奏。" +
      "每阶段都有可核对的成功标准，而不是只谈态度。" +
      "请结合该岗位的真实业务来具体化。",
  },
  {
    id: "bank-fit-003",
    category: "job_fit",
    difficulty: "easy",
    question: "这个岗位最吸引你的点是什么？",
    intent: "了解动机真实性与岗位研究深度",
    personalizedBridge: "结合你对 JD / 公司的真实研究改写",
    answerStrategy: "S：点出一个具体吸引点；T：说明为何匹配；A：用经历支撑；R：表达投入意愿",
    referenceAnswer:
      "最吸引我的是岗位与我过往经历的能力迁移路径清晰。" +
      "我研究了职责与成功标准，认为自己能在关键问题上快速创造价值。" +
      "请避免空泛赞美，落到具体业务点。",
  },
  // motivation
  {
    id: "bank-mot-001",
    category: "motivation",
    difficulty: "medium",
    question: "你短期和中期的职业目标分别是什么？",
    intent: "考察目标清晰度与稳定性",
    personalizedBridge: "用你真实的职业规划替换示范",
    answerStrategy: "S：给短期目标；T：给中期方向；A：说明路径；R：回扣本岗位",
    referenceAnswer:
      "短期我想在目标岗位上把关键能力做深，形成稳定交付；中期希望能独立负责更大范围的业务结果。" +
      "本岗位正好是这条路径上的关键一步。" +
      "请讲得具体，避免口号化。",
  },
  {
    id: "bank-mot-002",
    category: "motivation",
    difficulty: "easy",
    question: "什么类型的工作环境能让你发挥最好？",
    intent: "判断文化匹配与协作偏好",
    personalizedBridge: "结合你真实高效协作的环境描述",
    answerStrategy: "S：点出 1-2 个关键因素；T：说明原因；A：举经历；R：表达适配",
    referenceAnswer:
      "我在目标清晰、反馈及时、允许基于事实讨论的环境里效率最高。" +
      "过往经历里，这种环境帮助我更快闭环问题。" +
      "请用具体例子说明，而不是只列形容词。",
  },
  {
    id: "bank-mot-003",
    category: "motivation",
    difficulty: "hard",
    question: "如果本轮结果不理想，你会如何调整下一步？",
    intent: "考察抗挫与自我驱动",
    personalizedBridge: "用一次真实受挫后调整的经历替换",
    answerStrategy: "S：承认结果；T：定义学习目标；A：讲调整动作；R：给下一阶段计划",
    referenceAnswer:
      "我会先客观复盘差距来自能力、表达还是匹配度，再制定可执行的补齐计划。" +
      "同时保持对目标岗位的持续准备，而不是情绪化放弃。" +
      "请结合真实经历说明你如何把反馈转成行动。",
  },
]

const ALL_CATEGORIES: InterviewCategory[] = [
  "resume_deep_dive",
  "technical",
  "behavioral",
  "job_fit",
  "motivation",
]

const MIN_QUESTIONS_PER_CATEGORY = 3

export function validateInterviewBank(): {
  ok: boolean
  missingCategories: string[]
} {
  const missingCategories: string[] = []

  for (const category of ALL_CATEGORIES) {
    const count = INTERVIEW_QUESTION_BANK.filter((q) => q.category === category).length
    if (count < MIN_QUESTIONS_PER_CATEGORY) {
      missingCategories.push(category)
    }
  }

  return {
    ok: missingCategories.length === 0,
    missingCategories,
  }
}

function experienceLabel(context: InterviewContext, index: number): string {
  return context.experiences[index]?.label
    ?? context.experiences[0]?.label
    ?? "相关经历"
}

function experienceHighlight(context: InterviewContext, index: number): string {
  const experience = context.experiences[index] ?? context.experiences[0]
  return experience?.highlights[0]
    || experience?.summary
    || "需结合简历补充具体行动与结果"
}

function personalizeQuestion(
  base: InterviewQuestion,
  context: InterviewContext,
  jd: string,
): InterviewQuestion {
  const firstExperience = experienceLabel(context, 0)
  const secondExperience = experienceLabel(context, 1)
  const primarySkill = context.hardSkills[0] ?? context.skills[0] ?? "核心岗位能力"
  const firstHighlight = experienceHighlight(context, 0)
  const jdHint = context.keywords[0] ?? primarySkill ?? jd.slice(0, 24)

  if (base.id === "bank-rdd-001") {
    return {
      ...base,
      question: `请具体说明你在${firstExperience}中的个人职责和关键贡献。`,
      personalizedBridge: `用你【相关经历|${firstExperience}】的真实数据替换上述示范中的数字与场景`,
      referenceAnswer:
        `我想结合「${firstExperience}」来说明。当时团队目标是推进与岗位相关的业务结果，我负责关键推进与落地，而不是旁观协调。` +
        `具体行动上，我优先抓住最影响结果的环节，例如：${firstHighlight}。我会先对齐目标与约束，再拆分任务、推动执行，并定期复盘偏差。` +
        `最终我们拿到了可核验的结果，我也沉淀了可复用的方法。若细节还需核对，我会在面试前把职责边界、个人动作和数字再确认一遍，确保与简历完全一致，并回扣贵司对「${jdHint}」的要求。`,
    }
  }

  if (base.id === "bank-rdd-002") {
    return {
      ...base,
      question: `回顾${secondExperience}，最大的挑战是什么，你如何做出关键取舍？`,
      personalizedBridge: `用你【相关经历|${secondExperience}】的真实限制与取舍替换上述示范细节`,
    }
  }

  if (base.id === "bank-fit-001" || base.id === "bank-tech-001") {
    return {
      ...base,
      question: base.category === "job_fit"
        ? base.question
        : `请结合真实经历，说明你如何运用${primarySkill}解决岗位相关问题。`,
      personalizedBridge: `用你【相关经历|${firstExperience}】证明「${primarySkill}」如何落地`,
    }
  }

  return {
    ...base,
    personalizedBridge: base.personalizedBridge.includes("相关经历")
      ? base.personalizedBridge.replace("相关经历", firstExperience)
      : base.personalizedBridge,
  }
}

/** 模型失败时的兜底题：从题库抽样并轻度个性化 */
export function buildFallbackInterview(
  context: InterviewContext,
  jd: string,
): InterviewResult {
  const preferredIds = ["bank-rdd-001", "bank-rdd-002", "bank-fit-001"]
  const selected = preferredIds
    .map((id) => INTERVIEW_QUESTION_BANK.find((q) => q.id === id))
    .filter((q): q is InterviewQuestion => Boolean(q))

  // 若题库异常导致不足 3 题，继续从银行补齐
  for (const question of INTERVIEW_QUESTION_BANK) {
    if (selected.length >= 3) break
    if (!selected.some((item) => item.id === question.id)) {
      selected.push(question)
    }
  }

  return {
    source: "fallback",
    questions: selected.slice(0, 3).map((q) => personalizeQuestion(q, context, jd)),
    preparationChecklist: [
      "核对职责、时间与结果数字",
      "准备关键决策的替代方案",
      "梳理技能对应的真实案例",
    ],
  }
}

export function getInterviewQuestionBank(): InterviewQuestion[] {
  return INTERVIEW_QUESTION_BANK.map((q) => ({ ...q }))
}
