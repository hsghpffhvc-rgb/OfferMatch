import type {
  RequirementMapping,
  RewriteResult,
  StructuredResume,
  StructuredResumeHighlight,
  StructuredResumeItem,
  StructuredResumeSection,
  VerificationIssue,
} from "@/lib/agent/types"

/**
 * 确定性质量层：只做程序能保证的事。
 * - Markdown 正文永远由结构化简历渲染，不再接受模型自由拼装
 * - 清洗重复、内部标签、建议型技能、被污染的总结
 * - 截断 / 计划说成上线 / 目标说成结果 / 无来源数字 等可机检的事实风险
 *
 * 语义层面（是否新增了原文没有的行业、职责边界是否被放大）仍依赖模型判断，
 * 这里只做最后一道确定性兜底，不承诺"事实已全部验证"。
 */

/* ------------------------------------------------------------------ */
/* 内部标记与建议型文案                                                */
/* ------------------------------------------------------------------ */

const INTERNAL_MARKERS = [
  "目标岗位关键词",
  "目标能力",
  "建议补充",
  "需要展现",
  "需要突出",
  "建议突出",
  "待补充信息",
  "匹配分析",
  "改写建议",
  "重写建议",
  "关键词缺口",
  "本节建议",
  "优化建议",
  "qualityChecks",
  "rewrittenResumeMarkdown",
]

/** 建议型而非事实型的技能描述（功能 5：专业技能不该是"需要展现什么能力"） */
const ADVICE_PREFIX = /^(需要|建议|应当|应该|可考虑|可补充|宜|需补充|to\s*add)/i

const PLACEHOLDER = /XXX|×××/

function normalizeSpace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").trim()
}

function hasInternalMarker(text: string): boolean {
  return INTERNAL_MARKERS.some((marker) => text.includes(marker))
}

/** 去掉内部标记所在的行，正文不允许出现分析/建议类内容 */
function stripInternalLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !hasInternalMarker(line))
    .join("\n")
}

/* ------------------------------------------------------------------ */
/* 截断识别                                                            */
/* ------------------------------------------------------------------ */

const HARD_END = /[。！？!?）)」”"]$/

/**
 * 疑似截断：
 * - 以冒号、逗号、顿号、破折号、开括号结尾
 * - 冒号后只剩 1-2 个汉字（"业务调研与重构：针"）
 * - 以省略号结尾
 */
function looksTruncated(text: string): boolean {
  const normalized = normalizeSpace(text)
  if (!normalized) return false

  if (/\.{2,}$|…+$/.test(normalized)) return true

  const lastLine = normalized.split("\n").map((line) => line.trim()).filter(Boolean).pop() ?? ""
  if (!lastLine) return false

  if (/[：:，,、\-—（(【「“"]$/.test(lastLine)) return true
  if (/[：:]\s*[\u4e00-\u9fa5]{1,2}$/.test(lastLine)) return true
  if (lastLine.length > 6 && !HARD_END.test(lastLine) && /[：:]\s*$/.test(lastLine)) return true

  return false
}

/* ------------------------------------------------------------------ */
/* 总结 / 结构清洗                                                     */
/* ------------------------------------------------------------------ */

const CONTACT_PATTERN =
  /(\+?\d[\d\s-]{7,}\d)|[\w.+-]+@[\w-]+\.[\w.]+/
const RESUME_SECTION_TITLES = ["工作经历", "项目经历", "教育背景", "专业技能", "教育经历"]

function splitSentences(text: string): string[] {
  return normalizeSpace(text)
    .split(/(?<=[。！？!?；;])/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * 个人总结被污染（塞进联系方式或整份简历）时收紧为 2-3 句。
 * 根因：兜底内容与部分模型输出会把整份原文写进 summary.text。
 */
const GAP_SENTENCE_PATTERN = /缺乏|暂无|不具备|缺少相关|无相关(经历|经验)|尚未具备|未具备|有待提升|正在寻求/

/** 个人总结不写能力缺口，这类内容属于分析与待补充信息 */
function dropGapSentences(text: string): string {
  const sentences = splitSentences(text)
  if (!sentences.length) return text
  const kept = sentences.filter((sentence) => !GAP_SENTENCE_PATTERN.test(sentence))
  const result = kept.join("").trim()
  return result || sentences[0].trim()
}

function polishSummary(text: string): { text: string; polluted: boolean } {
  const raw = normalizeSpace(text)
  if (!raw) return { text: "", polluted: false }

  const hasContact = CONTACT_PATTERN.test(raw)
  const hitSectionTitle = RESUME_SECTION_TITLES.filter((title) => raw.includes(title)).length >= 2
  const tooLong = raw.length > 320 || raw.split("\n").filter(Boolean).length > 4

  if (!hasContact && !hitSectionTitle && !tooLong) {
    return { text: dropGapSentences(raw), polluted: false }
  }

  let clipped = raw
  if (hitSectionTitle) {
    const cutIndex = RESUME_SECTION_TITLES
      .map((title) => clipped.indexOf(title))
      .filter((index) => index > 0)
      .sort((a, b) => a - b)[0]
    if (cutIndex) clipped = clipped.slice(0, cutIndex)
  }

  clipped = clipped
    .split("\n")
    .filter((line) => !CONTACT_PATTERN.test(line) && !line.startsWith("#"))
    .join("")

  const sentences = splitSentences(clipped).slice(0, 3).join("")
  return { text: (sentences || clipped).slice(0, 260).trim(), polluted: true }
}

function highlightText(highlight: StructuredResumeHighlight): string {
  return [highlight.action, highlight.metric, highlight.result]
    .map((item) => normalizeSpace(item ?? ""))
    .filter(Boolean)
    .join("，")
}

function itemContentFingerprint(item: StructuredResumeItem): string {
  const parts = [
    normalizeSpace(item.role ?? item.name ?? item.title ?? ""),
    normalizeSpace(item.company ?? item.subtitle ?? item.school ?? ""),
    normalizeSpace(item.summary ?? item.notes ?? ""),
    ...(item.highlights ?? []).map((highlight) => highlightText(highlight)),
  ]
  return parts.filter(Boolean).join("|").replace(/\s+/g, "")
}

function isSkillAdvice(name: string): boolean {
  const text = normalizeSpace(name)
  if (!text) return true
  if (ADVICE_PREFIX.test(text)) return true
  if (hasInternalMarker(text)) return true
  return false
}

export interface NormalizeReport {
  summaryPolluted: boolean
  duplicatedLines: number
  droppedSkills: number
  internalMarkers: number
}

function normalizeResume(resume: StructuredResume): { resume: StructuredResume; report: NormalizeReport } {
  const report: NormalizeReport = {
    summaryPolluted: false,
    duplicatedLines: 0,
    droppedSkills: 0,
    internalMarkers: 0,
  }

  const summary = polishSummary(resume.summary?.text ?? "")
  report.summaryPolluted = summary.polluted

  const seenItems = new Set<string>()
  const seenHighlights = new Set<string>()
  const sections: StructuredResumeSection[] = []

  for (const section of resume.sections ?? []) {
    if (!section || !Array.isArray(section.items)) continue

    const title = normalizeSpace(section.title)
    if (hasInternalMarker(title)) {
      report.internalMarkers += 1
      continue
    }

    const items: StructuredResumeItem[] = []
    for (const item of section.items) {
      const fingerprint = itemContentFingerprint(item)
      if (!fingerprint) continue

      // 同一段内容重复出现（功能 2：原文与改写重复、项目重复）
      if (seenItems.has(fingerprint)) {
        report.duplicatedLines += 1
        continue
      }
      // 与个人总结完全相同的内容不再重复展示
      if (summary.text && fingerprint === summary.text.replace(/\s+/g, "")) {
        report.duplicatedLines += 1
        continue
      }
      seenItems.add(fingerprint)

      const highlights = (item.highlights ?? []).filter((highlight) => {
        const text = highlightText(highlight).replace(/\s+/g, "")
        if (!text) return false
        if (seenHighlights.has(text)) {
          report.duplicatedLines += 1
          return false
        }
        seenHighlights.add(text)
        return true
      })

      items.push({ ...item, highlights })
    }

    if (!items.length) continue
    if (sections.some((existing) => existing.type === section.type && existing.title === title)) continue
    sections.push({ ...section, title: title || "经历", items })
  }

  const seenSkills = new Set<string>()
  const skills = (resume.skills ?? []).flatMap((group) => {
    const items = (group.items ?? []).filter((skill) => {
      const name = normalizeSpace(skill?.name ?? "")
      if (isSkillAdvice(name)) {
        report.droppedSkills += 1
        return false
      }
      const key = name.toLowerCase()
      if (seenSkills.has(key)) {
        report.duplicatedLines += 1
        return false
      }
      seenSkills.add(key)
      return true
    })
    if (!items.length) return []
    const groupName = normalizeSpace(group.group)
    return [{
      group: hasInternalMarker(groupName) ? "专业技能" : groupName || "专业技能",
      items,
    }]
  })

  return {
    resume: {
      basics: {
        ...resume.basics,
        name: normalizeSpace(resume.basics?.name ?? ""),
        title: normalizeSpace(resume.basics?.title ?? ""),
        email: normalizeSpace(resume.basics?.email ?? ""),
        phone: normalizeSpace(resume.basics?.phone ?? ""),
        location: normalizeSpace(resume.basics?.location ?? ""),
        linkedin: normalizeSpace(resume.basics?.linkedin ?? ""),
        github: normalizeSpace(resume.basics?.github ?? ""),
        website: normalizeSpace(resume.basics?.website ?? ""),
      },
      summary: { ...resume.summary, text: summary.text },
      sections,
      skills,
    },
    report,
  }
}

/* ------------------------------------------------------------------ */
/* 正文渲染（唯一来源）                                                */
/* ------------------------------------------------------------------ */

const CONTACT_SEPARATOR = " | "

/** 由结构化简历渲染投递正文 Markdown；空模块直接省略，不留空标题 */
export function renderResumeMarkdown(resume: StructuredResume): string {
  const lines: string[] = []
  const basics = resume.basics ?? ({} as StructuredResume["basics"])

  if (basics.name) lines.push(`# ${basics.name}`)
  if (basics.title) lines.push(`**${basics.title}**`)

  const contacts = [basics.phone, basics.email, basics.location, basics.website, basics.github, basics.linkedin]
    .map((item) => normalizeSpace(item ?? ""))
    .filter(Boolean)
  if (contacts.length) lines.push(contacts.join(CONTACT_SEPARATOR))

  const summaryText = normalizeSpace(resume.summary?.text ?? "")
  if (summaryText) {
    lines.push("", "## 个人总结", summaryText)
  }

  for (const section of resume.sections ?? []) {
    const items = (section.items ?? []).filter(
      (item) =>
        normalizeSpace(item.role ?? item.name ?? item.title ?? "") ||
        normalizeSpace(item.summary ?? item.notes ?? "") ||
        (item.highlights ?? []).length,
    )
    if (!items.length) continue

    lines.push("", `## ${normalizeSpace(section.title) || "经历"}`)

    for (const item of items) {
      const heading = [item.role ?? item.name ?? item.title, item.company ?? item.subtitle ?? item.school]
        .map((value) => normalizeSpace(value ?? ""))
        .filter(Boolean)
        .join(" · ")
      const meta = [normalizeSpace(item.date?.start ?? ""), normalizeSpace(item.date?.end ?? "")]
        .filter(Boolean)
        .join(" - ")
      const location = normalizeSpace(item.location ?? "")
      const metaLine = [meta, location].filter(Boolean).join(CONTACT_SEPARATOR)

      if (heading) lines.push("", `**${heading}**`)
      if (metaLine) lines.push(metaLine)
      const description = normalizeSpace(item.summary ?? item.notes ?? "")
      if (description) lines.push(description)

      for (const highlight of item.highlights ?? []) {
        const text = highlightText(highlight)
        if (text) lines.push(`- ${text}`)
      }
    }
  }

  const skillGroups = (resume.skills ?? [])
    .map((group) => ({
      group: normalizeSpace(group.group) || "专业技能",
      items: (group.items ?? []).map((skill) => normalizeSpace(skill?.name ?? "")).filter(Boolean),
    }))
    .filter((group) => group.items.length)

  if (skillGroups.length) {
    lines.push("", "## 专业技能")
    for (const group of skillGroups) {
      lines.push(`- **${group.group}**：${group.items.join("、")}`)
    }
  }

  return stripInternalLines(lines.join("\n"))
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/* ------------------------------------------------------------------ */
/* 事实风险机检                                                        */
/* ------------------------------------------------------------------ */

const YEAR_LIKE = /^(19|20)\d{2}$/
const SHIPPED_PATTERN = /已上线|已正式上线|已落地|已投产|已交付使用|已全量/
const PLANNED_PATTERN = /规划|设计中|设计阶段|测试中|计划中|待上线|拟上线|试点/
const TARGET_PATTERN = /目标(覆盖|解决|提升|达到)/
const ACTUAL_PATTERN = /实际(覆盖|解决|提升|达到)/

const IDIOM_PATTERN = /从\s*0\s*(?:到|→|-|~)\s*1|0\s*(?:到|→|-|~)\s*1|零到一/g

function extractNumbers(text: string): string[] {
  // "从 0 到 1" 是固定搭配，不是数据
  const cleaned = text.replace(IDIOM_PATTERN, " ")
  const matches = cleaned.match(/\d+(?:\.\d+)?%?/g) ?? []
  return matches.filter((item) => !YEAR_LIKE.test(item))
}

/**
 * 正文里的数字必须能在原始简历或用户补充证据中找到，
 * 否则列为待核实（不自动删除，避免误删真实成果）。
 */
function findUnsourcedNumbers(body: string, sources: string): string[] {
  const sourceNumbers = new Set(extractNumbers(sources))
  const unsourced = new Set<string>()
  for (const value of extractNumbers(body)) {
    if (!sourceNumbers.has(value)) unsourced.add(value)
  }
  return [...unsourced]
}

const CHINESE_DIGITS: Record<string, string> = {
  一: "1", 两: "2", 二: "2", 三: "3", 四: "4", 五: "5",
  六: "6", 七: "7", 八: "8", 九: "9", 十: "10",
}

/**
 * 年限主张：把 "两年以上" / "3 年" 统一成数字年份，用于核对原文是否支持该年限。
 * 根因场景：原文只有两年任职时间且未注明 AI 方向时长，被写成 "两年以上 AI 产品经验"。
 */
function extractYearClaims(text: string): string[] {
  const claims = new Set<string>()
  const pattern = /([0-9]+|[一二两三四五六七八九十])\s*年(以上|多)?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[1]
    claims.add(CHINESE_DIGITS[raw] ?? raw)
  }
  return [...claims]
}

function findUnsourcedYearClaims(body: string, sources: string): string[] {
  const sourceClaims = new Set(extractYearClaims(sources))
  return extractYearClaims(body).filter((claim) => !sourceClaims.has(claim))
}

const NEGATION_PATTERN = /缺乏|暂无|不具备|缺少|未涉及|没有|无相关|尚未|未具备|无[\u4e00-\u9fa5]{0,4}经验/

/** 关键词是否被当作"已有能力"陈述（排除"目前缺乏 XX 经历"这类否定句） */
function keywordHits(keyword: string, body: string): boolean {
  const needle = normalizeSpace(keyword)
  if (needle.length < 2) return false

  const lines = body.split(/\n|。|；|;/)
  return lines.some((line) => {
    if (!line.includes(needle)) return false
    return !NEGATION_PATTERN.test(line)
  })
}

/** 原始简历里的技能块，用于完整性兜底（只取名称，去掉"精通/熟练"等自评） */
function extractSourceSkills(originalResume: string): string[] {
  const lines = originalResume.split("\n")
  const startIndex = lines.findIndex((line) => /^(专业技能|技能|技术栈|技能清单)/.test(line.trim()))
  if (startIndex < 0) return []

  const block: string[] = []
  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (block.length) break
      continue
    }
    if (/^(教育|工作|项目|荣誉|自我评价|证书|语言)/.test(trimmed)) break
    block.push(trimmed)
  }

  const tokens = block
    .join(" ")
    .replace(/^(专业技能|技能|技术栈|技能清单)[:：]?/, "")
    .split(/[、，,;；/|]+/)
    .map((token) => token.replace(/^(精通|熟练掌握|熟练|掌握|熟悉|了解|擅长)\s*/, "").trim())
    .filter((token) => token.length > 1 && token.length <= 20)

  return [...new Set(tokens)].slice(0, 12)
}

export interface AuditContext {
  originalResume: string
  evidence?: string
}

export interface AuditResult {
  rewrite: RewriteResult
  markdown: string
  issues: VerificationIssue[]
}

/**
 * 对阶段 D 结果做确定性校验与修复，并统一渲染正文。
 * - 可机修问题（重复、内部标签、总结污染、建议型技能）自动修复
 * - 事实类风险（截断、计划写成上线、目标写成结果、无来源数字）只标记，不脑补
 */
export function auditAndFinalizeRewrite(
  rewrite: RewriteResult,
  context: AuditContext,
): AuditResult {
  const issues: VerificationIssue[] = []
  const normalizedResult = normalizeResume(rewrite.resume)
  const resume = normalizedResult.resume
  const report = normalizedResult.report

  // 完整性兜底：原始简历有技能块但输出没写，按原文补回技能名称（去掉自评词）
  if ((resume.skills ?? []).length === 0) {
    const sourceSkills = extractSourceSkills(context.originalResume)
    if (sourceSkills.length > 0) {
      resume.skills = [{
        group: "专业技能",
        items: sourceSkills.map((name) => ({ name, category: "", level: "", evidence: "原始简历" })),
      }]
      issues.push({
        code: "MISSING_SECTION",
        message: `原始简历含技能信息但未输出，已按原文补回 ${sourceSkills.length} 项技能名称`,
        severity: "warning",
        autoFixed: true,
      })
    }
  }

  // 完整性提示：原文有教育经历但正文缺失，只提示，不猜测内容
  const hasEducationSection = (resume.sections ?? []).some((section) => section.type === "education")
  if (!hasEducationSection && /教育背景|教育经历|本科|硕士|博士|大学|学院/.test(context.originalResume)) {
    issues.push({
      code: "MISSING_SECTION",
      message: "原始简历含教育经历，但正文未包含教育背景模块，请确认是否需要补充",
      severity: "warning",
      autoFixed: false,
    })
  }

  if (report.summaryPolluted) {
    issues.push({
      code: "SUMMARY_POLLUTION",
      message: "个人总结混入了联系方式或整份简历内容，已收紧为 2-3 句概述",
      severity: "warning",
      autoFixed: true,
    })
  }
  if (report.duplicatedLines > 0) {
    issues.push({
      code: "DUPLICATE_CONTENT",
      message: `已合并 ${report.duplicatedLines} 处重复内容，避免原文与改写重复展示`,
      severity: "warning",
      autoFixed: true,
    })
  }
  if (report.droppedSkills > 0) {
    issues.push({
      code: "SKILL_ADVICE",
      message: `已移除 ${report.droppedSkills} 条“需要展现/建议补充”式的技能描述，只保留有来源的技能`,
      severity: "warning",
      autoFixed: true,
    })
  }
  if (report.internalMarkers > 0) {
    issues.push({
      code: "INTERNAL_MARKER",
      message: "已移除正文中的内部标记标题（如“目标岗位关键词”）",
      severity: "warning",
      autoFixed: true,
    })
  }

  const modelMarkdown = normalizeSpace(rewrite.rewrittenResumeMarkdown ?? "")
  if (modelMarkdown && hasInternalMarker(modelMarkdown)) {
    issues.push({
      code: "INTERNAL_MARKER",
      message: "模型 Markdown 中混入内部分析标记，已改用结构化正文重新渲染",
      severity: "warning",
      autoFixed: true,
    })
  }
  if (modelMarkdown && looksTruncated(modelMarkdown)) {
    issues.push({
      code: "TRUNCATED_OUTPUT",
      message: "模型的 Markdown 存在未完成句子，已改用结构化正文重新渲染",
      severity: "warning",
      autoFixed: true,
    })
  }

  const markdown = renderResumeMarkdown(resume)
  // 事实类检查同时覆盖最终正文与模型原始 Markdown：模型写法有风险也要暴露出来
  const candidateBodies = [markdown, modelMarkdown].filter(Boolean)

  if (!markdown.trim()) {
    issues.push({
      code: "PARSE_INCOMPLETE",
      message: "未生成可投递正文，结构化简历为空",
      severity: "error",
      autoFixed: false,
    })
  }

  const truncated = looksTruncated(markdown)
  if (truncated) {
    issues.push({
      code: "TRUNCATED_OUTPUT",
      message: "正文疑似被截断，停在未完成的句子上，请重新生成后再投递",
      severity: "error",
      autoFixed: false,
    })
  }

  const sources = [context.originalResume, context.evidence ?? ""].join("\n")
  const unsourced = findUnsourcedNumbers(candidateBodies.join("\n"), sources)
  if (unsourced.length > 0) {
    issues.push({
      code: "UNSOURCED_NUMBER",
      message: `以下数字在原始简历与补充证据中找不到来源，请核实：${unsourced.slice(0, 6).join("、")}`,
      severity: "warning",
      autoFixed: false,
    })
  }

  const unsourcedYears = findUnsourcedYearClaims(markdown, sources)
  if (unsourcedYears.length > 0) {
    issues.push({
      code: "UNSOURCED_NUMBER",
      message: `正文出现原文未支持的年限表述（${unsourcedYears.map((year) => `${year} 年`).join("、")}），请核实`,
      severity: "warning",
      autoFixed: false,
    })
  }

  const originalText = normalizeSpace(context.originalResume)
  const hasShipped = candidateBodies.some((body) => SHIPPED_PATTERN.test(body))
  const hasActual = candidateBodies.some((body) => ACTUAL_PATTERN.test(body))

  if (hasShipped && !SHIPPED_PATTERN.test(originalText) && PLANNED_PATTERN.test(originalText)) {
    issues.push({
      code: "PLANNED_AS_SHIPPED",
      message: "原文只写了规划/设计/测试状态，正文出现“已上线”类表述，请核实实施状态",
      severity: "error",
      autoFixed: false,
    })
  }
  if (hasActual && TARGET_PATTERN.test(originalText) && !ACTUAL_PATTERN.test(originalText)) {
    issues.push({
      code: "TARGET_AS_RESULT",
      message: "原文写的是目标值，正文出现“实际达成”类表述，请核实统计口径",
      severity: "error",
      autoFixed: false,
    })
  }

  const stillMissing = rewrite.scores?.keywordAnalysis?.stillMissing ?? []
  const leakedKeywords = stillMissing.filter((keyword) =>
    candidateBodies.some((body) => keywordHits(keyword, body)),
  )
  if (leakedKeywords.length > 0) {
    issues.push({
      code: "JD_AS_EXPERIENCE",
      message: `以下 JD 要求缺少证据，却出现在正文中：${leakedKeywords.slice(0, 5).join("、")}`,
      severity: "error",
      autoFixed: false,
    })
  }

  const requirements: RequirementMapping[] = (rewrite.analysis?.requirements ?? []).map((item) => {
    const status = item.status ?? "none"
    const evidence = (item.evidence ?? []).filter(Boolean)
    if (status !== "none" && evidence.length === 0) {
      return { ...item, status: "none" as const, note: item.note ?? "缺少可核对的简历原文支撑" }
    }
    return { ...item, status, evidence }
  })

  if (requirements.some((item) => item.status === "none")) {
    issues.push({
      code: "MISSING_EVIDENCE",
      message: "存在暂无证据的 JD 要求，已列为待补充信息，未写入正文",
      severity: "warning",
      autoFixed: false,
    })
  }

  const pending = [
    ...(rewrite.analysis?.gaps ?? []),
    ...requirements.filter((item) => item.status === "none").map((item) => `待补充证据：${item.requirement}`),
  ].filter(Boolean)

  const hasError = issues.some((issue) => issue.severity === "error")

  return {
    rewrite: {
      ...rewrite,
      resume,
      rewrittenResumeMarkdown: markdown,
      analysis: { requirements, gaps: rewrite.analysis?.gaps ?? [] },
      verification: {
        status: hasError ? "draft" : "ready",
        truncated,
        issues,
        pending: [...new Set(pending)].slice(0, 12),
      },
    },
    markdown,
    issues,
  }
}

/** 供 UI 判断是否可以直接投递 */
export function isDeliverable(rewrite: RewriteResult | null | undefined): boolean {
  if (!rewrite?.verification) return false
  return rewrite.verification.status === "ready" && Boolean(rewrite.rewrittenResumeMarkdown?.trim())
}
