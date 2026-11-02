import { test } from "node:test"
import assert from "node:assert/strict"

import { auditAndFinalizeRewrite, renderResumeMarkdown, isDeliverable } from "../lib/agent/rewrite-quality.ts"

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
