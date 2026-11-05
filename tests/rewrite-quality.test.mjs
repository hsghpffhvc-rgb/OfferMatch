import { test } from "node:test"
import assert from "node:assert/strict"
import { register } from "node:module"

// 质量门禁现在会复用 @/lib/agent/source-sections 的模块边界检测，
// 测试需要与脚本一致的 TS + 路径别名加载能力。
register("../scripts/ts-hook.mjs", import.meta.url)

const {
  auditAndFinalizeRewrite,
  renderResumeMarkdown,
  isDeliverable,
} = await import("../lib/agent/rewrite-quality.ts")
const {
  buildSourceSectionIndex,
  detectSectionBoundaryConflicts,
  renderSourceSectionIndex,
} = await import("../lib/agent/source-sections.ts")

/** 构造一份最小可用的 RewriteResult */
function makeRewrite(overrides = {}) {
  const base = {
    scores: {
      keywordCoverage: { before: 40, after: 70, gaps: [], improvements: [] },
      hardSkillMatch: { before: 40, after: 70, gaps: [], improvements: [] },
      softSkillMatch: { before: 40, after: 70, gaps: [], improvements: [] },
      experienceRelevance: { before: 40, after: 70, gaps: [], improvements: [] },
      quantification: { before: 40, after: 70, gaps: [], improvements: [] },
      starCompleteness: { before: 40, after: 70, gaps: [], improvements: [] },
      atsFriendliness: { before: 40, after: 70, gaps: [], improvements: [] },
      overallBefore: 40,
      overallAfter: 70,
      label: "基本匹配",
      keywordAnalysis: {
        jdKeywords: [],
        matched: [],
        missing: [],
        newlyCovered: [],
        stillMissing: [],
      },
      strengths: [],
      weaknesses: [],
      actionItems: [],
    },
    resume: {
      basics: {
        name: "候选人A",
        title: "AI 产品经理",
        email: "a@example.com",
        phone: "13800000000",
        location: "",
        linkedin: "",
        github: "",
        website: "",
        photo: "",
      },
      summary: { text: "校园 RAG 项目负责人，负责知识库搭建与回答质量评测。", positioning: "", yearsExperience: 0, keywords: [] },
      sections: [],
      skills: [],
    },
    rewrittenResumeMarkdown: "",
    modifications: [],
    analysis: { requirements: [], gaps: [] },
  }
  return { ...base, ...overrides }
}

function run(rewrite, context) {
  return auditAndFinalizeRewrite(rewrite, context)
}

/* 1. 校园 RAG + 医疗 JD：医疗要求无证据时不得出现在正文 */
test("场景1：无证据的医疗要求不得写入正文", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        {
          type: "experience",
          title: "项目经历",
          items: [{ role: "校园知识问答项目", summary: "基于 RAG 搭建校园知识库", highlights: [] }],
        },
      ],
    },
    scores: {
      ...makeRewrite().scores,
      keywordAnalysis: { jdKeywords: [], matched: [], missing: [], newlyCovered: [], stillMissing: ["医疗问答"] },
    },
    analysis: {
      requirements: [{ requirement: "医疗问答产品经验", status: "none", evidence: [] }],
      gaps: [],
    },
  })

  const clean = run(rewrite, { originalResume: "校园知识问答项目，负责 RAG 知识库搭建" })
  assert.equal(clean.markdown.includes("医疗"), false)
  assert.equal(clean.rewrite.verification.status, "ready")

  // 一旦正文出现该要求，必须判为不可直接投递
  const leaked = run({ ...rewrite, rewrittenResumeMarkdown: "## 项目经历\n- 负责医疗问答产品落地" }, { originalResume: "校园知识问答项目" })
  assert.ok(leaked.issues.some((issue) => issue.code === "JD_AS_EXPERIENCE"))
  assert.equal(leaked.rewrite.verification.status, "draft")
})

/* 2. 两年任职 + 未注明 AI 时长：不得支持“两年以上 AI 经验” */
test("场景2：原文未注明的年限会被标记待核实", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      summary: { text: "两年以上 AI 产品经验，擅长 RAG 与 Agent 产品设计。", positioning: "", yearsExperience: 2, keywords: [] },
    },
  })
  const result = run(rewrite, { originalResume: "2022.03 - 2024.03 某公司 产品经理，负责知识库" })
  assert.ok(result.issues.some((issue) => issue.code === "UNSOURCED_NUMBER" && issue.message.includes("年限")))
})

/* 3. 只有 RAG 证据 + Agent JD：不新增工具调用成果 */
test("场景3：Agent 要求无证据时只进分析，不进正文", () => {
  const rewrite = makeRewrite({
    scores: {
      ...makeRewrite().scores,
      keywordAnalysis: { jdKeywords: [], matched: [], missing: [], newlyCovered: [], stillMissing: ["工具调用"] },
    },
    analysis: { requirements: [{ requirement: "Agent 工具调用经验", status: "none", evidence: [] }], gaps: ["可补充工具调用链路设计经验"] },
    rewrittenResumeMarkdown: "## 项目经历\n- 主导工具调用链路设计，完成多工具编排",
  })
  const result = run(rewrite, { originalResume: "负责 RAG 知识库问答产品" })
  assert.ok(result.issues.some((issue) => issue.code === "JD_AS_EXPERIENCE"))
  assert.equal(result.rewrite.verification.status, "draft")
  assert.ok(result.rewrite.verification.pending.some((item) => item.includes("工具调用")))
})

/* 4. 规划三轮澄清：不能说成已上线 */
test("场景4：规划状态被写成已上线会拦截", () => {
  const rewrite = makeRewrite({
    rewrittenResumeMarkdown: "## 项目经历\n- 已上线三轮澄清流程，服务全校师生",
  })
  const result = run(rewrite, { originalResume: "规划三轮澄清流程，处于设计中" })
  assert.ok(result.issues.some((issue) => issue.code === "PLANNED_AS_SHIPPED"))
  assert.equal(result.rewrite.verification.status, "draft")
})

/* 5. 目标覆盖 85%：不能说成实际解决 85% */
test("场景5：目标值被写成实际结果会拦截", () => {
  const rewrite = makeRewrite({
    rewrittenResumeMarkdown: "## 项目经历\n- 实际解决 85% 的问答问题",
  })
  const result = run(rewrite, { originalResume: "目标覆盖 85% 的问题" })
  assert.ok(result.issues.some((issue) => issue.code === "TARGET_AS_RESULT"))
  assert.equal(result.rewrite.verification.status, "draft")
})

/* 6. 重复段落：输出不重复，且不误删不同项目 */
test("场景6：重复内容被合并，不同项目保留", () => {
  const duplicated = {
    type: "experience",
    title: "工作经历",
    items: [
      { role: "公司A", summary: "负责知识库建设", highlights: [{ action: "搭建 RAG 知识库", metric: "", result: "" }] },
      { role: "公司A", summary: "负责知识库建设", highlights: [{ action: "搭建 RAG 知识库", metric: "", result: "" }] },
    ],
  }
  const other = {
    type: "projects",
    title: "项目经历",
    items: [{ role: "项目B", summary: "负责 Agent 产品规划", highlights: [] }],
  }

  const rewrite = makeRewrite({ resume: { ...makeRewrite().resume, sections: [duplicated, other] } })
  const result = run(rewrite, { originalResume: "内部材料" })

  const occurrences = result.markdown.split("搭建 RAG 知识库").length - 1
  assert.equal(occurrences, 1)
  assert.ok(result.markdown.includes("Agent 产品规划"))
  assert.ok(result.issues.some((issue) => issue.code === "DUPLICATE_CONTENT" && issue.autoFixed))
})

/* 7. 截断：停在“业务调研与重构：针”不能被当成完整简历 */
test("场景7：截断正文被识别为待完善草稿", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [{ role: "公司A", summary: "负责业务调研与重构：针", highlights: [] }],
        },
      ],
    },
  })
  const result = run(rewrite, { originalResume: "公司A 负责业务调研与重构" })
  assert.equal(result.rewrite.verification.truncated, true)
  assert.equal(result.rewrite.verification.status, "draft")
  assert.equal(isDeliverable(result.rewrite), false)
})

/* 8. 模型返回截断 Markdown：改用结构化正文渲染 */
test("场景8：截断的模型 Markdown 不会作为成稿展示", () => {
  const rewrite = makeRewrite({
    rewrittenResumeMarkdown: "## 工作经历\n- 负责业务调研与重构：针",
  })
  const result = run(rewrite, { originalResume: "公司A 负责业务调研" })
  assert.equal(result.markdown.includes("：针"), false)
  assert.ok(result.issues.some((issue) => issue.code === "TRUNCATED_OUTPUT" && issue.autoFixed))
})

/* 9. 没有教育/技能：不补造、不留空标题 */
test("场景9：缺失模块不生成空标题", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        { type: "experience", title: "工作经历", items: [{ role: "公司A", summary: "负责知识库建设", highlights: [] }] },
        { type: "education", title: "教育背景", items: [] },
      ],
      skills: [],
    },
  })
  const result = run(rewrite, { originalResume: "公司A 负责知识库建设" })
  assert.equal(result.markdown.includes("教育背景"), false)
  assert.equal(result.markdown.includes("专业技能"), false)
  assert.equal(result.markdown.includes("XXX"), false)
})

/* 10. 分析中的建议不进入正文 */
test("场景10：建议与内部标记不进入正文与导出", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [{
            role: "公司A",
            summary: "负责知识库建设",
            highlights: [{ action: "搭建 RAG 知识库", metric: "覆盖 12 个部门", result: "" }],
          }],
        },
        { type: "skills", title: "目标岗位关键词", items: [{ role: "建议补充留存数据" }] },
      ],
      skills: [
        { group: "目标能力", items: [{ name: "需要展现数据能力", category: "", level: "", evidence: "" }] },
        { group: "专业技能", items: [{ name: "RAG 知识库搭建", category: "", level: "", evidence: "项目经历" }] },
      ],
    },
    rewrittenResumeMarkdown: "## 个人总结\n需要展现数据能力\n\n## 目标岗位关键词\n建议补充留存数据",
  })

  const result = run(rewrite, { originalResume: "公司A 负责知识库建设，覆盖 12 个部门" })
  for (const marker of ["目标岗位关键词", "目标能力", "需要展现", "建议补充"]) {
    assert.equal(result.markdown.includes(marker), false, `正文不应包含 ${marker}`)
  }
  assert.ok(result.issues.some((issue) => issue.code === "SKILL_ADVICE" && issue.autoFixed))
})

/* 11. 有充分证据的能力：不能被约束误删 */
test("场景11：有证据的 JD 能力可以正常强调", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      summary: { text: "RAG 知识库产品负责人，主导从 0 到 1 搭建与效果评测。", positioning: "", yearsExperience: 0, keywords: [] },
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [{
            role: "公司A",
            company: "某科技公司",
            date: { start: "2022.03", end: "至今" },
            summary: "负责企业知识库问答产品",
            highlights: [{ action: "搭建 RAG 检索链路", metric: "覆盖 12 个部门", result: "回答准确率从 62% 提升到 85%" }],
          }],
        },
      ],
      skills: [{ group: "专业技能", items: [{ name: "RAG", category: "", level: "", evidence: "项目经历" }] }],
    },
    analysis: {
      requirements: [{ requirement: "RAG 知识库建设", status: "direct", evidence: ["搭建 RAG 检索链路"] }],
      gaps: [],
    },
  })

  const result = run(rewrite, { originalResume: "搭建 RAG 检索链路，覆盖 12 个部门，准确率 62% 提升到 85%" })
  assert.ok(result.markdown.includes("RAG 检索链路"))
  assert.ok(result.markdown.includes("85%"))
  assert.equal(result.rewrite.verification.status, "ready")
  assert.equal(isDeliverable(result.rewrite), true)
})

/* 12. 同一指标冲突：进入待核实，不自动选更高值 */
test("场景12：指标冲突进入待核实而不是自动取值", () => {
  const rewrite = makeRewrite({
    analysis: {
      requirements: [],
      gaps: ["两处材料的准确率口径不一致（62% vs 75%），待核实"],
    },
  })
  const result = run(rewrite, { originalResume: "准确率 62%" })
  assert.ok(result.rewrite.verification.pending.some((item) => item.includes("待核实")))
})

/* 附：结构渲染与去重的基本契约 */
test("正文渲染顺序与结构", () => {
  const markdown = renderResumeMarkdown({
    basics: { name: "候选人A", title: "AI 产品经理", email: "a@example.com", phone: "", location: "", linkedin: "", github: "", website: "", photo: "" },
    summary: { text: "负责 RAG 知识库产品。", positioning: "", yearsExperience: 0, keywords: [] },
    sections: [
      { type: "experience", title: "工作经历", items: [{ role: "产品经理", company: "某科技", date: { start: "2022.03", end: "至今" }, summary: "负责知识库", highlights: [] }] },
    ],
    skills: [{ group: "专业技能", items: [{ name: "RAG", category: "", level: "", evidence: "" }] }],
  })

  const order = ["# 候选人A", "## 个人总结", "## 工作经历", "## 专业技能"].map((item) => markdown.indexOf(item))
  assert.ok(order.every((index) => index >= 0))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
})

/* 13. 项目经历必须被保留为独立章节，且不被工作经历吃掉 */
test("场景13：项目经历保留为 projects 章节且不与工作经历重复", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [{ role: "产品负责人", company: "某高校", summary: "负责知识问答产品", highlights: [] }],
        },
        {
          type: "project", // 模型常见的单数写法
          title: "校园知识问答系统",
          items: [
            {
              role: "校园知识问答系统",
              summary: "基于 RAG 搭建校园知识库",
              highlights: [{ action: "设计 RAG 双路召回", metric: "覆盖 12 个院系", result: "" }],
            },
          ],
        },
      ],
    },
  })

  const result = run(rewrite, { originalResume: "项目经历\n校园知识问答系统：基于 RAG 搭建" })
  const types = result.rewrite.resume.sections.map((section) => section.type)
  assert.ok(types.includes("projects"), "应包含 projects 章节")
  assert.ok(result.markdown.includes("## 项目经历"))
  // 工作经历在前、项目经历在后
  assert.ok(result.markdown.indexOf("## 工作经历") < result.markdown.indexOf("## 项目经历"))
})

/* 14. 专业技能不重复大标题，按能力维度分组 */
test("场景14：技能按能力维度分组且不重复“专业技能”", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      skills: [
        {
          group: "专业技能", // 与一级标题同名
          items: [
            { name: "产品能力：用户研究、PRD 撰写、验收测试", category: "", level: "", evidence: "原文" },
          ],
        },
        {
          group: "技术能力",
          items: [{ name: "RAG", category: "", level: "", evidence: "项目经历" }],
        },
      ],
    },
  })

  const result = run(rewrite, { originalResume: "专业技能\n用户研究、PRD 撰写、RAG" })
  const headingCount = result.markdown.split("## 专业技能").length - 1
  assert.equal(headingCount, 1, "“专业技能”应只作为一级标题出现一次")
  assert.equal(result.markdown.includes("**专业技能**"), false, "不应出现重复的专业技能小标题")
  assert.ok(result.markdown.includes("用户研究"))
  assert.ok(result.markdown.includes("PRD 撰写"))
  assert.ok(result.markdown.includes("**技术能力**"))
})

/* 15. 日期不应被当成无来源数字 */
test("场景15：任职日期不会被误判为无来源数字", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [{ role: "产品经理", company: "某公司", date: { start: "2024.04", end: "2026.09" }, summary: "负责知识库", highlights: [] }],
        },
      ],
    },
  })
  const result = run(rewrite, { originalResume: "某公司 产品经理 2024.04 - 2026.09" })
  assert.equal(
    result.issues.some((issue) => issue.code === "UNSOURCED_NUMBER" && issue.message.includes("2024")),
    false,
  )
})

/* 16. 原始简历有项目但输出没有：产生可操作提示 */
test("场景16：原始简历含项目模块但输出缺失时给出提示", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        { type: "experience", title: "工作经历", items: [{ role: "产品经理", company: "某公司", summary: "负责知识库", highlights: [] }] },
      ],
    },
  })
  const result = run(rewrite, { originalResume: "工作经历\n某公司\n\n项目经历\n校园问答系统" })
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "MISSING_SECTION" && issue.message.includes("项目经历"),
    ),
  )
})

/* 17. 模型漏掉项目/教育：不把原文照搬进正文，而是阻断为待完善草稿 */
test("场景17：漏掉项目与教育时不照搬原文，状态转为待完善草稿", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        { type: "experience", title: "工作经历", items: [{ role: "AI产品负责人", company: "某高校", summary: "负责知识问答", highlights: [] }] },
      ],
      skills: [],
    },
  })

  const original = [
    "工作经历",
    "2024.04 - 2026.09  某高校  AI产品负责人",
    "- 负责知识问答系统规划",
    "",
    "项目经历",
    "校园知识问答系统（2024.04 - 2025.12，项目负责人）",
    "- 设计 RAG 双路召回，召回率由 0.68 提升至 0.88",
    "",
    "教育背景",
    "2018.09 - 2023.06  某大学  信息管理  本科",
  ].join("\n")

  const result = run(rewrite, { originalResume: original })

  // 正文不能出现未改写的原文段落
  assert.equal(result.markdown.includes("## 项目经历"), false)
  assert.equal(result.markdown.includes("## 教育背景"), false)
  assert.equal(result.markdown.includes("设计 RAG 双路召回，召回率由 0.68 提升至 0.88"), false)

  // 必须阻断为待完善草稿，并给出可操作提示
  assert.equal(result.rewrite.verification.status, "draft")
  assert.equal(isDeliverable(result.rewrite), false)
  const messages = result.issues.filter((issue) => issue.code === "MISSING_SECTION")
  assert.ok(messages.some((issue) => issue.message.includes("项目经历") && issue.severity === "error"))
  assert.ok(messages.some((issue) => issue.message.includes("教育背景") && issue.severity === "error"))
})

/* 18. 复合技能名按维度拆分 */
test("场景18：复合技能串按能力维度拆分", () => {
  const rewrite = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      skills: [
        {
          group: "专业技能",
          items: [
            { name: "产品能力：用户研究、PRD 撰写 技术能力：RAG、Prompt Engineering 工具：Figma、Cursor", category: "", level: "", evidence: "" },
          ],
        },
      ],
    },
  })

  const result = run(rewrite, { originalResume: "专业技能\n产品能力：用户研究、PRD 撰写" })
  const groups = result.rewrite.resume.skills
  assert.deepEqual(groups.map((group) => group.group), ["产品能力", "技术能力", "工具"])
  assert.ok(result.markdown.includes("- **技术能力**：RAG、Prompt Engineering"))
  assert.equal(result.markdown.split("## 专业技能").length - 1, 1)
})

/* 19. 漏模块阻断后，补齐的模型结果可以恢复为可投递 */
test("场景19：补齐项目章节后重新变为可投递", () => {
  const base = makeRewrite({
    resume: {
      ...makeRewrite().resume,
      sections: [
        { type: "experience", title: "工作经历", items: [{ role: "AI产品负责人", company: "某高校", summary: "负责知识问答", highlights: [] }] },
      ],
      skills: [],
    },
  })
  const original = "工作经历\n2024.04 - 2026.09 某高校 AI产品负责人\n\n项目经历\n校园知识问答系统（2024.04 - 2025.12，项目负责人）\n- 设计 RAG 双路召回\n"

  const before = run(base, { originalResume: original })
  assert.equal(before.rewrite.verification.status, "draft")

  const repaired = makeRewrite({
    resume: {
      ...before.rewrite.resume,
      sections: [
        ...before.rewrite.resume.sections,
        {
          type: "projects",
          title: "项目经历",
          items: [
            {
              name: "校园知识问答系统",
              role: "项目负责人",
              date: { start: "2024.04", end: "2025.12" },
              summary: "面向校园场景的 RAG 知识问答系统",
              highlights: [{ action: "设计双路召回并完成精排", metric: "召回率由 0.68 提升至 0.88", result: "覆盖 12 个院系" }],
            },
          ],
        },
      ],
    },
  })

  const after = run(repaired, { originalResume: original })
  assert.equal(after.markdown.includes("## 项目经历"), true)
  assert.equal(after.rewrite.verification.status, "ready")
  assert.equal(isDeliverable(after.rewrite), true)
})

/* 20. 技能补回必须留下可追溯提示，不伪装成模型产出 */
test("场景20：技能由原文补回时会标注待确认", () => {
  const rewrite = makeRewrite({ resume: { ...makeRewrite().resume, skills: [] } })
  const result = run(rewrite, { originalResume: "专业技能\n产品能力：用户研究、PRD 撰写" })
  assert.ok(result.rewrite.resume.skills.length > 0)
  assert.ok(result.rewrite.verification.pending.some((item) => item.includes("技能")))
  assert.ok(result.issues.some((issue) => issue.code === "MISSING_SECTION" && issue.autoFixed))
})

/* ------------------------------------------------------------------ */
/* 模块边界：实习不得并进全职岗、项目不得复述工作经历                     */
/* ------------------------------------------------------------------ */

const INTERNSHIP_ORIGINAL = [
  "工作经历",
  "2024.04 - 2026.09  某高校  AI 产品经理",
  "- 负责校园知识问答系统规划",
  "",
  "实习经历",
  "2023.05 - 2023.09  某科技公司  产品实习生",
  "- 负责知识库标注与评测",
  "",
  "项目经历",
  "校园知识问答系统（2024.04 - 2025.12，项目负责人）",
  "- 设计 RAG 双路召回，召回率由 0.68 提升至 0.88",
].join("\n")

const SNAPSHOT_INDEX = {
  origin: "snapshot",
  hasInternship: true,
  internshipLabels: ["产品实习生"],
  internshipAsOwnSection: true,
  sections: [
    {
      kind: "experience",
      title: "工作经历",
      items: [
        { label: "AI 产品经理", meta: "某高校", date: "2024.04 - 2026.09", internship: false },
        { label: "产品实习生", meta: "某科技公司", date: "2023.05 - 2023.09", internship: true },
      ],
    },
    {
      kind: "projects",
      title: "项目经历",
      items: [
        { label: "校园知识问答系统", meta: "项目负责人", date: "2024.04 - 2025.12", internship: false },
      ],
    },
  ],
}

function internshipRewrite(experienceItems, projectItems) {
  const base = makeRewrite()
  return {
    ...base,
    resume: {
      ...base.resume,
      sections: [
        { type: "experience", title: "工作经历", items: experienceItems },
        { type: "projects", title: "项目经历", items: projectItems },
      ],
    },
  }
}

/* 21. 实习被并进全职岗：阻断为待完善草稿 */
test("场景21：实习被并入全职岗位会被拦截", () => {
  const merged = internshipRewrite(
    [
      {
        role: "AI 产品经理",
        company: "某高校",
        summary: "负责知识问答系统规划，并主导知识库标注与评测",
        highlights: [{ action: "负责校园知识问答系统规划与知识库评测", metric: "", result: "" }],
      },
    ],
    [
      {
        name: "校园知识问答系统",
        role: "项目负责人",
        summary: "设计双路召回并完成精排",
        highlights: [{ action: "设计 RAG 双路召回", metric: "召回率由 0.68 提升至 0.88", result: "" }],
      },
    ],
  )

  const result = run(merged, { originalResume: INTERNSHIP_ORIGINAL, sourceIndex: SNAPSHOT_INDEX })
  const boundary = result.issues.filter((issue) => issue.code === "SECTION_BOUNDARY")
  assert.ok(boundary.some((issue) => issue.message.includes("实习")))
  assert.equal(result.rewrite.verification.status, "draft")
})

/* 22. 项目复述工作经历：同一段事实出现在两个模块 */
test("场景22：项目经历复述工作经历会被拦截", () => {
  const shared = {
    summary: "负责校园知识问答系统的规划与落地",
    highlights: [
      { action: "设计三轮澄清流程并推动上线", metric: "覆盖 12 个院系", result: "问答准确率提升到 85%" },
    ],
  }
  const duplicated = internshipRewrite(
    [
      { role: "AI 产品实习生", company: "某科技公司", ...shared },
      { role: "AI 产品经理", company: "某高校", summary: "负责知识问答产品规划", highlights: [] },
    ],
    [{ name: "校园知识问答系统", role: "项目负责人", ...shared }],
  )

  const result = run(duplicated, { originalResume: INTERNSHIP_ORIGINAL, sourceIndex: SNAPSHOT_INDEX })
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "SECTION_BOUNDARY" && issue.message.includes("项目经历"),
    ),
  )
})

/* 23. 实习独立条目 + 独立项目：不误报，保持可投递 */
test("场景23：实习独立成条时不做误伤", () => {
  const healthy = internshipRewrite(
    [
      { role: "AI 产品经理", company: "某高校", summary: "负责校园知识问答产品的需求与验收", highlights: [] },
      {
        role: "产品实习生",
        company: "某科技公司",
        summary: "支撑知识库建设",
        highlights: [{ action: "搭建评测集并完成基线标注", metric: "覆盖 300 条样本", result: "" }],
      },
    ],
    [
      {
        name: "校园知识问答系统",
        role: "项目负责人",
        summary: "面向校园场景的双路召回方案",
        highlights: [{ action: "设计 RAG 双路召回并完成精排", metric: "召回率由 0.68 提升至 0.88", result: "" }],
      },
    ],
  )

  const result = run(healthy, {
    originalResume: INTERNSHIP_ORIGINAL,
    sourceIndex: SNAPSHOT_INDEX,
  })
  assert.equal(
    result.issues.some((issue) => issue.code === "SECTION_BOUNDARY"),
    false,
    "实习独立条目不应被判为边界冲突",
  )
  assert.equal(result.rewrite.verification.status, "ready")
})

/* 24. 结构索引渲染：把实习身份显式传给改写阶段 */
test("场景24：结构索引会把实习身份写入提示词块", () => {
  const index = buildSourceSectionIndex(
    {
      basics: { name: "候选人A", title: "AI 产品经理", contact: "" },
      summary: "",
      sections: [
        {
          title: "实习经历",
          items: [{ label: "产品实习生", meta: "某科技公司", date: "2023.05 - 2023.09", points: [] }],
        },
        { title: "项目经历", items: [{ label: "校园知识问答系统", meta: "项目负责人", points: [] }] },
      ],
      coverage: { sourceChars: 0, coveredItems: 2, extras: [] },
    },
    INTERNSHIP_ORIGINAL,
  )

  assert.equal(index.origin, "snapshot")
  const block = renderSourceSectionIndex(index)
  assert.ok(block.includes("实习"))
  assert.ok(block.includes("项目经历"))
  assert.ok(block.includes("禁止把工作经历职责改写成项目条目"))

  const conflicts = detectSectionBoundaryConflicts(
    {
      basics: {},
      summary: {},
      skills: [],
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [{ role: "AI 产品经理", company: "某高校", highlights: [] }],
        },
      ],
    },
    index,
  )
  assert.ok(conflicts.some((conflict) => conflict.code === "INTERNSHIP_MERGED"))
})
/* 25. 实习条目必须从工作经历里拆出来，独立成「实习经历」模块 */
test("场景25：工作经历里的实习条目会被拆到独立的实习经历模块", () => {
  const rewrite = internshipRewrite(
    [
      { role: "AI 产品经理", company: "武汉设计工程学院", summary: "负责知识问答产品规划", highlights: [] },
      {
        role: "产品运营实习生（内容向）",
        company: "字节跳动 · 西瓜视频",
        summary: "负责创作者运营",
        highlights: [{ action: "搭建可复用选题库", metric: "粉丝量提升 20%", result: "" }],
      },
    ],
    [
      {
        name: "校园知识问答系统",
        role: "项目负责人",
        summary: "面向校园场景的双路召回方案",
        highlights: [{ action: "设计 RAG 双路召回并完成精排", metric: "召回率由 0.68 提升至 0.88", result: "" }],
      },
    ],
  )

  const result = run(rewrite, {
    originalResume: INTERNSHIP_ORIGINAL,
    sourceIndex: SNAPSHOT_INDEX,
  })

  const experienceSections = result.rewrite.resume.sections.filter(
    (section) => section.type === "experience",
  )
  const fullTime = experienceSections.find((section) => section.title === "工作经历")
  const internship = experienceSections.find((section) => section.title === "实习经历")

  assert.ok(fullTime, "应保留工作经历模块")
  assert.ok(internship, "实习应独立成模块")
  assert.equal(fullTime.items.length, 1)
  assert.equal(fullTime.items[0].company, "武汉设计工程学院")
  assert.equal(internship.items.length, 1)
  assert.ok(internship.items[0].role.includes("实习"))
  assert.ok(result.markdown.includes("## 实习经历"))
})

/* 26. 同一项目的多个奖项归并为一条 */
test("场景26：同一项目的多个奖项合并为一条", () => {
  const base = makeRewrite()
  const rewrite = {
    ...base,
    resume: {
      ...base.resume,
      sections: [
        {
          type: "experience",
          title: "工作经历",
          items: [
            {
              role: "AI 产品经理",
              company: "某高校",
              highlights: [{ action: "负责知识库评测", metric: "", result: "" }],
            },
          ],
        },
        {
          type: "awards",
          title: "荣誉奖项",
          items: [
            { name: "三下乡社会实践", notes: "湖北省优秀团队" },
            { name: "三下乡社会实践", notes: "省二等奖（村域数字化研究成果）" },
            { name: "一等奖学金", notes: "" },
          ],
        },
      ],
    },
  }

  const result = run(rewrite, {
    originalResume: INTERNSHIP_ORIGINAL,
    sourceIndex: SNAPSHOT_INDEX,
  })

  const awards = result.rewrite.resume.sections.find((section) => section.type === "awards")
  assert.ok(awards)
  assert.equal(awards.items.length, 2, "三下乡的两个奖项应合并为一条")
  assert.equal(awards.items[0].name, "三下乡社会实践")
  assert.ok(awards.items[0].notes.includes("湖北省优秀团队"))
  assert.ok(awards.items[0].notes.includes("省二等奖"))
  assert.ok(result.markdown.includes("湖北省优秀团队、省二等奖"))
})

test("跨部门任职概括不是岗位，原文总述与真实岗位信息保留", () => {
  const original = "拥有丰富的跨部门工作经验，先后在图书馆资源推广中心、基建处以及人工智能中心三个不同职能部门任职与历练。深度参与部门日常事务，积极承担上级需求并推动业务落地，具备业务协调与资源整合能力。"
  const rewrite = makeRewrite()
  rewrite.resume.sections = [{type:"experience",title:"工作经历",items:[
    {company:"某单位",role:"多部门任职与历练",summary:original,highlights:[]},
    {company:"某单位",role:"AI 产品负责人",projectName:"企业知识库问答系统",highlights:[{title:"需求调研",action:"开展需求调研"}]},
    {company:"某单位",role:"跨部门项目负责人",projectName:"业务项目",highlights:[{title:"项目推进",action:"协调项目"}]},
  ]}]
  const result = run(rewrite, {originalResume:original})
  const items = result.rewrite.resume.sections[0].items
  assert.equal(items[0].role, "")
  assert.ok(items[0].summary.includes("图书馆资源推广中心"))
  assert.ok(items[0].summary.includes("基建处"))
  assert.ok(items[0].summary.includes("人工智能中心"))
  assert.equal(items[2].role, "跨部门项目负责人")
  assert.ok(result.markdown.includes("**企业知识库问答系统** · AI 产品负责人"))
  assert.ok(!result.markdown.includes("**多部门任职与历练"))
})

test('明确的校园与志愿模块按原名保留，实习字样不会改变校园归属', () => {
  const base = makeRewrite()
  const sections = [
    { type:'experience', title:'校园经历', items:[{name:'学生会', summary:'组织实习分享活动。',highlights:[]}] },
    { type:'experience', title:'志愿服务', items:[{name:'社区志愿者',summary:'协助开展活动。',highlights:[]}] },
  ]
  const result=run({...base,resume:{...base.resume,sections}},{originalResume:'校园经历：组织实习分享活动。\n志愿服务：协助开展活动。'})
  assert.deepEqual(result.rewrite.resume.sections.map(s=>s.title), ['校园经历','志愿服务'])
  assert.ok(!result.issues.some(i=>i.code==='SECTION_BOUNDARY' && /原文含/.test(i.message)))
})

test('来源有明确模块但改写遗漏时标为草稿并触发结构修复', async () => {
  const {getBlockingStructuralIssues}=await import('../lib/agent/rewrite-quality.ts')
  const base=makeRewrite()
  const source='社会实践：开展乡村调研。\n志愿服务：参与社区活动。'
  const result=run(base,{originalResume:source})
  assert.equal(result.rewrite.verification.status,'draft')
  assert.equal(result.issues.filter(i=>i.code==='SECTION_BOUNDARY' && /原文含/.test(i.message)).length,2)
  assert.equal(getBlockingStructuralIssues(base,source).length,2)
})

test('不同日期的相似经历及跨经历相同职责不会被静默删除', () => {
  const base=makeRewrite()
  const items=[{company:'同一单位',role:'运营',date:{start:'2020',end:'2021'},highlights:[{action:'负责用户调研'}]}, {company:'同一单位',role:'运营',date:{start:'2022',end:'2023'},highlights:[{action:'负责用户调研'}]}]
  const result=run({...base,resume:{...base.resume,sections:[{type:'experience',title:'工作经历',items}]}},{originalResume:'工作经历\n2020 - 2021 运营\n2022 - 2023 运营'})
  assert.equal(result.rewrite.resume.sections[0].items.length,2)
  assert.ok(result.rewrite.resume.sections[0].items.every(item=>item.highlights.length===1))
})
