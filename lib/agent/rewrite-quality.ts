import type {
  RequirementMapping,
  RewriteResult,
  StructuredResume,
  StructuredResumeHighlight,
  StructuredResumeItem,
  StructuredResumeSection,
  StructuredResumeSkill,
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

const SECTION_TYPE_ALIASES: Record<string, string> = {
  project: "projects",
  projects: "projects",
  work: "experience",
  works: "experience",
  employment: "experience",
  job: "experience",
  edu: "education",
  school: "education",
  award: "awards",
  honor: "awards",
  honours: "awards",
  certificate: "certifications",
  language: "languages",
}

const SECTION_TITLE_BY_TYPE: Record<string, string> = {
  experience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
  awards: "荣誉奖项",
  languages: "语言能力",
  certifications: "证书",
}

/**
 * 归一化章节类型与标题。
 * 模型常把项目写成 type:"project"（单数）或把项目标题塞进 experience，
 * 后者会让 PDF 的 VALID_SECTION_TYPES 直接丢弃整段内容。
 */
function normalizeSectionMeta(section: StructuredResumeSection): { type: string; title: string } {
  const rawType = normalizeSpace(section.type ?? "").toLowerCase()
  const title = normalizeSpace(section.title ?? "")
  let type = SECTION_TYPE_ALIASES[rawType] ?? rawType

  if (!type || type === "experience") {
    if (/项目/.test(title)) type = "projects"
    else if (/教育|学历/.test(title)) type = "education"
    else if (/荣誉|奖项/.test(title)) type = "awards"
    else if (/语言/.test(title)) type = "languages"
    else if (/证书|认证/.test(title)) type = "certifications"
    else if (!type) type = "experience"
  }

  const canonical = SECTION_TITLE_BY_TYPE[type]
  const titleMatchesType =
    type === "experience"
      ? /工作|任职|实习|就业/.test(title)
      : type === "projects"
        ? /项目/.test(title)
        : type === "education"
          ? /教育|学历/.test(title)
          : type === "awards"
            ? /荣誉|奖项/.test(title)
            : type === "languages"
              ? /语言/.test(title)
              : type === "certifications"
                ? /证书|认证/.test(title)
                : Boolean(title)

  // 章节标题应是模块名（如"项目经历"）：标题不像模块名时一律用标准标题，
  // 否则 Markdown/PDF 会失去模块层级（例如出现 "## 校园知识问答系统"）
  if (canonical && !titleMatchesType) return { type, title: canonical }
  return { type, title: title || canonical || "经历" }
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

/** 技能维度不能用一级标题名，否则会出现"专业技能 > 专业技能" */
const GENERIC_SKILL_GROUPS = /^(专业技能|技能|技术技能|核心技能|其他技能)$/

function normalizeSkillGroupName(value: string): string {
  const name = normalizeSpace(value)
  if (!name || hasInternalMarker(name) || GENERIC_SKILL_GROUPS.test(name)) return ""
  return name
}

/**
 * 拆分 "产品能力：用户研究、PRD 撰写" 这类复合技能名：
 * 冒号前是能力维度，冒号后按顿号/逗号拆成独立技能。
 */
function splitCompositeSkillName(
  rawName: string,
  groupName: string,
  category?: string,
): { dimension: string; names: string[] } {
  const cleaned = rawName
    .replace(/^(熟练|精通|掌握|熟悉|了解|使用)\s*/, "")
    .replace(/[，,、;；]+$/, "")
    .trim()

  const separatorIndex = cleaned.search(/[：:]/)
  let dimension = normalizeSkillGroupName(groupName) || normalizeSkillGroupName(category ?? "")
  let payload = cleaned

  if (separatorIndex > 0) {
    const head = normalizeSkillGroupName(cleaned.slice(0, separatorIndex))
    if (head) dimension = head
    payload = cleaned.slice(separatorIndex + 1)
  }

  const names = payload
    .split(/[、，,;；/|]+/)
    .map((item) => normalizeSpace(item).replace(/^(使用|熟练使用)\s*/, ""))
    .filter((item) => item.length > 0 && item.length <= 30)

  return { dimension, names: names.length ? names : [cleaned] }
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

  // 去重优先级：项目经历先处理，重复内容优先保留在项目块而不是工作经历块
  const SECTION_PRIORITY = ["projects", "experience", "education", "awards", "languages", "certifications"]
  const orderedSections = [...(resume.sections ?? [])].sort((a, b) => {
    const ai = SECTION_PRIORITY.indexOf(a?.type ?? "")
    const bi = SECTION_PRIORITY.indexOf(b?.type ?? "")
    return (ai < 0 ? SECTION_PRIORITY.length : ai) - (bi < 0 ? SECTION_PRIORITY.length : bi)
  })

  for (const section of orderedSections) {
    if (!section || !Array.isArray(section.items)) continue

    const title = normalizeSpace(section.title)
    if (hasInternalMarker(title)) {
      report.internalMarkers += 1
      continue
    }
    const meta = normalizeSectionMeta(section)

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

    // 同类型章节合并（例如工作经历被拆成两块），避免重复标题
    const existing = sections.find((entry) => entry.type === meta.type)
    if (existing) {
      existing.items.push(...items)
      continue
    }

    sections.push({ ...section, type: meta.type, title: meta.title, items })
  }

  const seenSkills = new Set<string>()
  const skillGroups: Array<{ group: string; items: StructuredResumeSkill[] }> = []

  const addSkill = (dimension: string, rawName: string, template: StructuredResumeSkill) => {
    const name = normalizeSpace(rawName)
      .replace(/^(使用|熟练使用|精通|熟练掌握|熟练|掌握|熟悉|了解|擅长)\s*/, "")
      .replace(/[，,、;；]+$/, "")
      .trim()
    if (!name || isSkillAdvice(name)) {
      report.droppedSkills += 1
      return
    }
    const key = name.toLowerCase()
    if (seenSkills.has(key)) {
      report.duplicatedLines += 1
      return
    }
    seenSkills.add(key)

    const groupName = normalizeSkillGroupName(dimension)
    const target = skillGroups.find((entry) => entry.group === groupName)
    const next: StructuredResumeSkill = { ...template, name }
    if (target) target.items.push(next)
    else skillGroups.push({ group: groupName, items: [next] })
  }

  for (const group of resume.skills ?? []) {
    const groupDimension = normalizeSkillGroupName(group.group)
    for (const skill of group.items ?? []) {
      const rawName = normalizeSpace(skill?.name ?? "")
      if (!rawName) {
        report.droppedSkills += 1
        continue
      }

      // 模型常把整个分组塞进一个 name："产品能力：用户研究、PRD 撰写"
      const segments = parseSkillSegments(rawName)
      const isStructured = segments.length > 1
        || (segments.length === 1 && Boolean(segments[0].dimension))
        || /[、，,;；]/.test(rawName)

      if (isStructured) {
        for (const segment of segments) {
          const dimension = segment.dimension || groupDimension || skill?.category || ""
          for (const item of segment.items) addSkill(dimension, item, skill)
        }
        continue
      }

      addSkill(groupDimension || skill?.category || "", rawName, skill)
    }
  }

  const skills = skillGroups.filter((group) => group.items.length > 0)

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

  const RENDER_ORDER = ["experience", "projects", "education", "awards", "languages", "certifications"]
  const renderSections = [...(resume.sections ?? [])].sort((a, b) => {
    const ai = RENDER_ORDER.indexOf(a?.type ?? "")
    const bi = RENDER_ORDER.indexOf(b?.type ?? "")
    return (ai < 0 ? RENDER_ORDER.length : ai) - (bi < 0 ? RENDER_ORDER.length : bi)
  })

  for (const section of renderSections) {
    const items = (section.items ?? []).filter(
      (item) =>
        normalizeSpace(item.role ?? item.name ?? item.title ?? "") ||
        normalizeSpace(item.school ?? "") ||
        normalizeSpace(item.degree ?? item.major ?? "") ||
        normalizeSpace(item.summary ?? item.notes ?? "") ||
        (item.highlights ?? []).length,
    )
    if (!items.length) continue

    lines.push("", `## ${normalizeSpace(section.title) || "经历"}`)

    for (const item of items) {
      // 项目：项目名称 · 个人角色；教育：学校 · 专业/学位；工作：岗位 · 单位
      const isProject = section.type === "projects"
      const isEducation = section.type === "education"
      const primary = isProject
        ? item.name ?? item.title ?? item.role
        : isEducation
          ? item.school ?? item.name ?? item.title
          : item.role ?? item.title ?? item.name
      const secondary = isProject
        ? (item.role && item.role !== primary ? item.role : item.company ?? item.subtitle)
        : isEducation
          ? item.degree ?? item.major ?? item.subtitle
          : item.company ?? item.subtitle ?? item.school

      const heading = [primary, secondary]
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
      group: normalizeSpace(group.group),
      items: (group.items ?? []).map((skill) => normalizeSpace(skill?.name ?? "")).filter(Boolean),
    }))
    .filter((group) => group.items.length)

  if (skillGroups.length) {
    lines.push("", "## 专业技能")
    const hasNamedGroups = skillGroups.some((group) => group.group)
    for (const group of skillGroups) {
      // 只有一个无维度名的分组时直接平铺，避免出现"专业技能：专业技能"
      const label = group.group || (hasNamedGroups && skillGroups.length > 1 ? "通用能力" : "")
      lines.push(label ? `- **${label}**：${group.items.join("、")}` : `- ${group.items.join("、")}`)
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
  const cleaned = text
    .replace(IDIOM_PATTERN, " ")
    // 日期（2024.04 / 2024-04 / 2024/04 / 2024年4月）不是可核对的数据指标
    .replace(/\d{4}\s*[.\-/年]\s*\d{1,2}\s*月?/g, " ")
    .replace(/\d{4}\s*[.\-/]\s*[0-1]?\d/g, " ")
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

/**
 * 解析一段技能文本为「能力维度 → 技能项」。
 * 支持 "产品能力：用户研究、PRD 撰写 技术能力：RAG" 这类混排写法。
 */
function parseSkillSegments(rawText: string): Array<{ dimension: string; items: string[] }> {
  const text = rawText
    .replace(/\r/g, "")
    .replace(/[\n；;]+/g, " 、 ")
    .replace(/\s*[：:]\s*/g, "：")

  const groups: Array<{ dimension: string; items: string[] }> = []
  const push = (dimension: string, body: string) => {
    const items = body
      .split(/[、，,;；/|]+/)
      .map((item) => item.replace(/^(精通|熟练掌握|熟练|掌握|熟悉|了解|擅长|使用)\s*/, "").trim())
      .filter((item) => item.length > 0 && item.length <= 24)
    if (!items.length) return
    const cleanDimension = normalizeSkillGroupName(dimension)
    if (cleanDimension) {
      const existing = groups.find((group) => group.dimension === cleanDimension)
      if (existing) existing.items.push(...items)
      else groups.push({ dimension: cleanDimension, items })
      return
    }
    const target = groups.find((group) => group.dimension === "")
    if (target) target.items.push(...items)
    else groups.push({ dimension: "", items })
  }

  // 逐个识别 "维度：" 标签，标签之间就是该维度下的技能项
  const labelPattern = /([\u4e00-\u9fa5]{2,8})\s*：/g
  let cursor = 0
  let dimension = ""
  let match: RegExpExecArray | null

  while ((match = labelPattern.exec(text)) !== null) {
    push(dimension, text.slice(cursor, match.index))
    dimension = match[1]
    cursor = match.index + match[0].length
  }
  push(dimension, text.slice(cursor))

  return groups.map((group) => ({ ...group, items: [...new Set(group.items)] }))
}

/** 原始简历里的技能块，用于完整性兜底（分组保留，只取名称） */
function extractSourceSkills(originalResume: string): Array<{ dimension: string; items: string[] }> {
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

  const groups = parseSkillSegments(
    block.join("\n").replace(/^(专业技能|技能|技术栈|技能清单)[:：]?/, ""),
  )

  return groups
    .map((group) => ({ ...group, items: group.items.slice(0, 8) }))
    .filter((group) => group.items.length > 0)
    .slice(0, 4)
}

/* ------------------------------------------------------------------ */
/* 原文兜底解析：模型漏掉模块时，用原始简历原文补齐（不改写事实）        */
/* ------------------------------------------------------------------ */

const SECTION_HEADING_RE =
  /^(工作经历|工作经验|项目经历|项目经验|核心项目|代表项目|主要项目|项目实践|教育背景|教育经历|专业技能|技能|荣誉奖项|获奖情况|自我评价|证书|语言能力)\s*[：:]?$/

const BULLET_RE = /^[-•*·●○◦▪\u2022]\s*/
const DATE_IN_LINE = /(\d{4}\s*[.\-/年]\s*\d{1,2}\s*月?)\s*[-–—~至]\s*(\d{4}\s*[.\-/年]\s*\d{1,2}\s*月?|至今|今)/

/** 取出原文某个章节的正文行（不带章节标题本身） */
function extractBlockLines(originalResume: string, headings: RegExp): string[] {
  const lines = originalResume.split("\n")
  const start = lines.findIndex((line) => headings.test(line.trim()))
  if (start < 0) return []

  const block: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (SECTION_HEADING_RE.test(line.trim())) break
    block.push(line)
  }
  return block
}

export interface ParsedOriginalItem {
  name: string
  role: string
  date: { start?: string; end?: string }
  description: string
  bullets: string[]
}

/** 从原文项目块粗解析条目；解析不出来就退化为整块一条 */
export function parseOriginalProjectItems(originalResume: string): ParsedOriginalItem[] {
  const lines = extractBlockLines(originalResume, /^(项目经历|项目经验|核心项目|代表项目|主要项目|项目实践)\s*[：:]?$/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const items: ParsedOriginalItem[] = []
  let current: ParsedOriginalItem | null = null

  const flush = () => {
    if (current && (current.name || current.bullets.length || current.description)) items.push(current)
    current = null
  }

  for (const line of lines) {
    const isBullet = BULLET_RE.test(line)
    const text = line.replace(BULLET_RE, "").trim()
    if (!text) continue

    if (isBullet) {
      if (!current) {
        current = { name: "", role: "", date: {}, description: "", bullets: [] }
      }
      current.bullets.push(text)
      continue
    }

    // 非 bullet 行：形如 "项目名（角色） 2024.04 - 2025.12" 或 "项目名（2024.04 - 2025.12，项目负责人）"
    const parenGroups = [...text.matchAll(/[（(]([^（()）]{1,40})[）)]/g)].map((match) => match[1])
    const dateSource = text.match(DATE_IN_LINE) ?? parenGroups.join(" ").match(DATE_IN_LINE)
    const roleFromParens = parenGroups
      .map((group) => group.replace(DATE_IN_LINE, "").replace(/[，,、\s]+/g, " ").trim())
      .find((group) => group.length > 0 && group.length <= 20) ?? ""

    const head = text
      .replace(/[（(][^（()）]{1,40}[）)]/g, " ")
      .replace(DATE_IN_LINE, " ")
      .replace(/[，,、\-–—\s]+$/g, "")
      .trim()
    const looksLikeTitle = Boolean(dateSource) || Boolean(roleFromParens) || head.length <= 40

    if (looksLikeTitle && (current === null || current.bullets.length > 0)) {
      flush()
      current = {
        name: head || text,
        role: roleFromParens,
        date: dateSource ? { start: dateSource[1].trim(), end: dateSource[2].trim() } : {},
        description: "",
        bullets: [],
      }
      continue
    }

    if (!current) {
      current = { name: head.slice(0, 40), role: "", date: {}, description: text, bullets: [] }
    } else if (!current.description) {
      current.description = text
    } else {
      current.bullets.push(text)
    }
  }

  flush()
  return items.slice(0, 6)
}

/** 从原文教育块粗解析出一个教育条目 */
export function parseOriginalEducationItems(originalResume: string): ParsedOriginalItem[] {
  const lines = extractBlockLines(originalResume, /^(教育背景|教育经历)\s*[：:]?$/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const text = lines.join(" ")
  const dateMatch = text.match(DATE_IN_LINE)
  const head = lines[0]
    .replace(BULLET_RE, "")
    .replace(DATE_IN_LINE, " ")
    .replace(/[，,]+/g, " ")
    .trim()
  const parts = head.split(/\s{2,}|\t+/).map((part) => part.trim()).filter(Boolean)
  const name = parts[0] ?? head.slice(0, 60)

  return [{
    name,
    role: "",
    date: dateMatch ? { start: dateMatch[1].trim(), end: dateMatch[2].trim() } : {},
    description: [parts.slice(1).join(" · "), lines.slice(1).join(" ")].filter(Boolean).join(" · ").slice(0, 200),
    bullets: [],
  }]
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
    const sourceSkillGroups = extractSourceSkills(context.originalResume)
    const sourceSkillCount = sourceSkillGroups.reduce((total, group) => total + group.items.length, 0)
    if (sourceSkillCount > 0) {
      resume.skills = sourceSkillGroups.map((group) => ({
        group: group.dimension,
        items: group.items.map((name) => ({ name, category: "", level: "", evidence: "原始简历" })),
      }))
      issues.push({
        code: "MISSING_SECTION",
        message: `原始简历含技能信息但未输出，已按原文补回 ${sourceSkillCount} 项技能（按原维度分组）`,
        severity: "warning",
        autoFixed: true,
      })
    }
  }

  // 完整性兜底：原文有教育经历但模型漏掉了 → 按原文补齐（不改写）
  const hasEducationSection = (resume.sections ?? []).some((section) => section.type === "education")
  if (!hasEducationSection && /教育背景|教育经历/.test(context.originalResume)) {
    const parsedEducation = parseOriginalEducationItems(context.originalResume)
    if (parsedEducation.length > 0 && parsedEducation[0].name) {
      resume.sections.push({
        type: "education",
        title: "教育背景",
        items: parsedEducation.map((item, index) => ({
          school: item.name,
          date: item.date,
          notes: item.description,
          order: index + 1,
        })),
      })
      issues.push({
        code: "MISSING_SECTION",
        message: "模型未保留教育背景，已按原始简历补齐（原文保留，请核对）",
        severity: "warning",
        autoFixed: true,
      })
    } else {
      issues.push({
        code: "MISSING_SECTION",
        message: "原始简历含教育经历，但正文未包含教育背景模块，请确认是否需要补充",
        severity: "warning",
        autoFixed: false,
      })
    }
  }

  // 完整性兜底：原文有项目经历但模型漏掉了 → 用原文条目补齐（只保留事实，不做改写）
  const hasProjectsSection = (resume.sections ?? []).some((section) => section.type === "projects")
  if (!hasProjectsSection && originalHasProjectBlock(context.originalResume)) {
    const parsedProjects = parseOriginalProjectItems(context.originalResume)
    if (parsedProjects.length > 0) {
      resume.sections.push({
        type: "projects",
        title: "项目经历",
        items: parsedProjects.map((item, index) => ({
          name: item.name,
          role: item.role,
          date: item.date,
          summary: item.description,
          highlights: item.bullets.map((bullet) => ({ action: bullet, metric: "", result: "" })),
          order: index + 1,
          notes: "以下内容按原始简历保留，未做重写，请核对后再投递",
        })),
      })
      issues.push({
        code: "MISSING_SECTION",
        message: `模型未保留项目经历，已按原始简历补齐 ${parsedProjects.length} 个项目（原文保留，未做改写）`,
        severity: "warning",
        autoFixed: true,
      })
    } else {
      issues.push({
        code: "MISSING_SECTION",
        message: "原始简历含项目经历，但正文未保留项目模块，请重新生成以保留与岗位相关的项目",
        severity: "warning",
        autoFixed: false,
      })
    }
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

/** 原始简历是否包含项目模块（用于判断重写是否漏项） */
export function originalHasProjectBlock(originalResume: string): boolean {
  return /(^|\n)\s*(项目经历|项目经验|核心项目|代表项目|主要项目|项目实践)/.test(originalResume)
}

/** 重写结果里是否有可渲染的项目模块 */
export function hasProjectSection(rewrite: RewriteResult | null | undefined): boolean {
  return Boolean(rewrite?.resume?.sections?.some((section) => section.type === "projects"))
}

/** 供 UI 判断是否可以直接投递 */
export function isDeliverable(rewrite: RewriteResult | null | undefined): boolean {
  if (!rewrite?.verification) return false
  return rewrite.verification.status === "ready" && Boolean(rewrite.rewrittenResumeMarkdown?.trim())
}
