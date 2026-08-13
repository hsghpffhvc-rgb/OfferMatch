# OfferMatch 技术规格说明书 (SDD)

> AI 生成代码前的"边界围栏"。每个新功能开发前，先在此文档中完成规格定义。
>
> **使用方式**：在 Cursor 对话中输入 `@SDD.md`，然后描述功能需求。

---

## 1. 产品概述

**产品名称**：OfferMatch
**定位**：上传简历 + JD，AI 分析匹配度并生成优化简历（PC 端 Web 应用）
**目标用户**：中文求职者，国内招聘市场
**技术栈**：Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + OpenAI SDK

## 2. 系统架构

```
[用户] → [Next.js App Router] → [/api/chat SSE] → [lib/agent/run-agent.ts] → [OpenAI/通义千问]
                                    ↑
                              lib/agent/prompts.ts
```

## 3. 核心功能链路（当前版本）

### 3.1 三阶段 Agent 流程

| 阶段 | 输入 | 输出 | 文件 |
|------|------|------|------|
| A: 候选人画像 | JD 文本 | `PersonaResult`（技能、行业、痛点等） | `lib/agent/prompts.ts` → `buildPersonaPrompt` |
| B: 理想简历大纲 | 画像结果 | `OutlineResult`（摘要+章节+亮点） | `lib/agent/prompts.ts` → `buildOutlinePrompt` |
| C: 差异化重写 | 原始简历+大纲 | `RewriteResult`（评分+Markdown简历+修改清单） | `lib/agent/prompts.ts` → `buildRewritePrompt` |

类型定义见 `lib/agent/types.ts`，核心逻辑见 `lib/agent/run-agent.ts`。

### 3.2 文档解析

- 支持 PDF（文本/扫描版 OCR）、Word (docx)、TXT
- 扫描版 PDF 使用 Tesseract.js OCR
- 文件大小限制在 `lib/document/constants.ts` 中定义

---

## 4. 功能模块规格

### 4.1 多维评分雷达图

**优先级**：P0
**依赖**：无
**阶段**：第一阶段

**功能描述**：
从当前单一匹配度分数升级为六维雷达图（技能匹配/经验匹配/教育匹配/内容完整度/表达清晰度/ATS兼容性）。

**输入**：
- 简历文本
- JD 文本

**输出**：
```
{ overall, skillMatch, experienceMatch, educationMatch, clarity, atsCompatibility }
```

**SSE 事件**：
```
{ type: "result", phase: "score", data: {...六维分数...} }
```

**前端组件**：
- `components/radar-chart.tsx`：使用 Recharts 渲染六维雷达图
- 在 `MatchScoreCard` 组件中集成

**验收标准**：
- [ ] 上传简历+JD 后，雷达图显示 6 个维度的分数
- [ ] 每个维度有对应的优化建议
- [ ] 图表响应式适配移动端

---

### 4.2 国内 ATS 适配检测

**优先级**：P0
**依赖**：无
**阶段**：第一阶段

**功能描述**：
检测简历在 BOSS 直聘/智联招聘/Moka 等国内招聘平台的解析兼容性，标注可能被截断或解析失败的字段。

---

### 4.3 持续职业档案

**优先级**：P0
**依赖**：无
**阶段**：第一~二阶段

**功能描述**：
保存用户的多版本简历、技能标签、求职历史，实现"越用越懂你"的 Agent 体验。

---

### 4.4 AI 模拟面试

**优先级**：P1
**依赖**：4.3（职业档案）
**阶段**：第二阶段

---

### 4.5 求职全流程追踪

**优先级**：P2
**依赖**：4.3（职业档案）
**阶段**：第三阶段

---

### 4.6 AI 内容去 AI 化

**优先级**：P1
**依赖**：无
**阶段**：第二阶段

**功能描述**：
检测改写后简历的 AI 痕迹，提供"去 AI 味"优化建议，降低被招聘经理识别的风险。

---

### 4.7 空状态优化

**优先级**：P0
**依赖**：无
**阶段**：第一阶段（本周）

**问题诊断**：
当前右侧数据看板在"未分析"状态下，存在三处影响用户体验的问题：
1. `TrendChart` 使用硬编码 Mock 数据（周一 62 → 周日 88），在无历史数据时显示虚假 +26% 增长
2. `analysis-workspace.tsx` 中 StatCard 的 `value`/`delta` 字段在 `scores` 为 null 时显示 `"—"`，但交互钩子（trend="up"）仍为有效值，视觉上有语义矛盾
3. 首次进入页面时，整个右侧面板只有标题和 `"—"` 占位，缺乏引导性

**改动范围**（仅改现有文件，不新增组件）：

---

#### 4.7.1 TrendChart — 替换硬编码数据为状态感知显示

**文件**：`components/trend-chart.tsx`

**改动**：
```tsx
// 改动前：硬编码 const data = [{day:"周一",score:62},...]
// 改动后：新增 props，根据是否有数据决定显示内容

interface TrendChartProps {
  history?: { date: string; score: number }[]    // 可选，来自后端历史记录
}

export function TrendChart({ history }: TrendChartProps) {
  const hasData = history && history.length > 0

  if (!hasData) {
    // 空状态：引导文案
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
        <p className="text-sm font-medium">匹配度走势</p>
        <p className="text-xs text-muted-foreground">近 7 天平均匹配分数</p>
        <div className="mt-4 flex h-32 items-center justify-center rounded-xl bg-secondary/30">
          <p className="text-xs text-muted-foreground">
            分析 3 次后将展示匹配度走势
          </p>
        </div>
      </div>
    )
  }

  // 原有图表渲染逻辑，改用 history 数据
  // +26% 标签改为动态计算（最新 vs 最旧）
  // ...
}
```

**验收标准**：
- [ ] 首次进入页面，趋势图区域显示"分析 3 次后将展示匹配度走势"
- [ ] 无假数据、无 +26% 标签
- [ ] 保留 `analysis-workspace.tsx` 中的 `<TrendChart />` 调用，不新增 props（先不改父组件传参）

---

#### 4.7.2 StatCard 空状态 — 语义一致性

**文件**：`components/analysis-workspace.tsx`

**改动**（仅改 StatCard 调用处的 props）：
```tsx
// 改动前：trend 在无数据时仍为 "up" 或 "down"
<StatCard
  label="投递成功率"
  value={scores ? `${Math.min(95, scores.overall + 5)}%` : "—"}
  delta={scores ? "AI" : "—"}
  trend="up"    // ← 无数据时仍显示绿色箭头
/>

// 改动后：trend 受 scores 控制，无数据时不显示方向图标
<StatCard
  label="投递成功率"
  value={scores ? `${Math.min(95, scores.overall + 5)}%` : "—"}
  delta={scores ? "AI" : ""}
  trend={scores ? "up" : "neutral"}    // ← neutral 不显示箭头
/>
```

**StatCard 组件改动**（`components/stat-card.tsx`）：
```tsx
// Props 新增可选值
interface StatCardProps {
  trend: "up" | "down" | "neutral"   // 新增 "neutral"
}

// 渲染时：trend === "neutral" 时不显示箭头，delta 为空时隐藏标签
```

**验收标准**：
- [ ] 无数据时 StatCard 不显示方向箭头
- [ ] delta 为空字符串时，对应标签隐藏
- [ ] 有分析结果后，行为与当前完全一致

---

#### 4.7.3 整体空状态引导 — 首次进入页面

**文件**：`components/analysis-workspace.tsx`

**改动**：在 `<aside>` 顶部新增一个空状态引导（仅在无分析结果时显示）：
```tsx
{!scores && !isStreaming && (
  <div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-6 text-center">
    <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground/40" />
    <p className="text-sm font-medium text-muted-foreground">开始分析你的匹配度</p>
    <p className="mt-1 text-xs text-muted-foreground/70">
      上传简历并粘贴岗位 JD，AI 将全面评估你的竞争力
    </p>
  </div>
)}
```

**验收标准**：
- [ ] 首次进入页面时，右侧面板顶部显示引导卡片
- [ ] 点击"开始分析"或上传简历后（`isStreaming = true`），引导卡片消失
- [ ] 分析完成后（`scores` 不为 null），引导卡片不再出现
- [ ] 移动端同样显示

---

### 4.8 PDF 导出（Gengar 极简模板）

**优先级**：P0
**依赖**：4.7（完成后方可开始）
**阶段**：第一阶段（本周）

**功能描述**：
用户获得 Agent C 的 STAR 改写结果后，可将改写后的简历导出为 PDF。首版支持 1 套模板（Gengar 极简风），模板架构预留扩展能力。

**技术方案**：基于 `@react-pdf/renderer` 在服务端渲染 PDF，架构上采用三层设计（样式工厂 → 模板组件 → Section 自动路由），每加一套新模板仅需 ~30 行代码。

---

#### 4.8.1 依赖安装

```bash
npm install @react-pdf/renderer
```

> ⚠️ 锁定版本：`@react-pdf/renderer` v3.x（已验证与 Next.js 16 兼容），不装 v4.x。

---

#### 4.8.2 数据模型 — `lib/pdf/types.ts`

**新建文件**：`lib/pdf/types.ts`

```typescript
// ===== 基础信息 =====
export interface ResumeBasics {
  name: string
  title: string            // 目标岗位
  email: string
  phone: string
  location?: string
  linkedin?: string
  github?: string
}

// ===== 章节定义 =====
export type SectionType =
  | "summary" | "experience" | "education"
  | "skills" | "projects" | "languages" | "certifications"

export type SectionPlacement = "sidebar" | "main"

export interface ResumeSectionItem {
  title?: string            // 职位/学校/技能名
  subtitle?: string          // 公司/专业
  date?: string              // 时间范围
  location?: string
  description?: string       // STAR 描述（Agent C 输出）
  highlights?: string[]      // 要点列表
  url?: string
  level?: number             // 技能熟练度 0-5
  degree?: string
  gpa?: string
}

export interface ResumeSection {
  id: string
  type: SectionType
  title: string
  placement: SectionPlacement
  items: ResumeSectionItem[]
}

// ===== 完整简历数据 =====
export interface ResumeData {
  basics: ResumeBasics
  sections: ResumeSection[]
  metadata: {
    template: string
    generatedAt: string
  }
}

// ===== 模板主题 =====
export interface ResumeTheme {
  primary: string
  primaryTint: string
  background: string
  foreground: string
  mutedForeground: string
  fontFamily: string
  headingFontFamily: string
  fontSize: {
    name: number
    heading: number
    body: number
    small: number
  }
  spacing: {
    section: number
    paragraph: number
    item: number
  }
}
```

**约束**：
- 所有字段平铺，不嵌套超过 3 层
- SectionType 为联合类型，新增类型需同步更新 SectionRenderer
- ResumeTheme 不包含 `fontWeight`——全部通过 `fontFamily` 变体控制

---

#### 4.8.3 基础样式工厂 — `lib/pdf/styles/base-styles.ts`

**新建文件**：`lib/pdf/styles/base-styles.ts`

```typescript
import { StyleSheet } from "@react-pdf/renderer"
import type { ResumeTheme } from "@/lib/pdf/types"

export function createBaseResumeStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    page: {
      padding: 0,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize.body,
      color: theme.foreground,
      backgroundColor: theme.background,
      lineHeight: 1.5,
    },
    header: {
      backgroundColor: theme.primary,
      padding: 28,
    },
    headerName: {
      fontSize: theme.fontSize.name,
      fontFamily: theme.headingFontFamily,
      color: "#ffffff",
      fontWeight: "bold" as const,
    },
    headerContact: {
      fontSize: theme.fontSize.small,
      color: "rgba(255,255,255,0.85)",
      marginTop: 6,
    },
    body: {
      flexDirection: "row" as const,
      flex: 1,
    },
    sidebar: {
      width: "30%",
      backgroundColor: theme.primaryTint,
      padding: 20,
    },
    main: {
      width: "70%",
      padding: 24,
    },
    sectionHeading: {
      fontSize: theme.fontSize.heading,
      fontFamily: theme.headingFontFamily,
      color: theme.primary,
      fontWeight: "bold" as const,
      marginBottom: 8,
    },
    sectionSpacing: {
      marginBottom: theme.spacing.section,
    },
    title: {
      fontSize: theme.fontSize.body,
      fontWeight: "bold" as const,
      color: theme.foreground,
    },
    subtitle: {
      fontSize: theme.fontSize.body,
      color: theme.primary,
    },
    muted: {
      fontSize: theme.fontSize.small,
      color: theme.mutedForeground,
    },
    bodyText: {
      fontSize: theme.fontSize.body,
      color: theme.foreground,
    },
    spacingParagraph: {
      marginBottom: theme.spacing.paragraph,
    },
    spacingItem: {
      marginBottom: theme.spacing.item,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: theme.primaryTint,
      marginVertical: 8,
    },
    skillTag: {
      backgroundColor: theme.background,
      color: theme.primary,
      fontSize: theme.fontSize.small,
      padding: "4 8" as any,
      borderRadius: 4,
      marginRight: 4,
      marginBottom: 4,
    },
    outlineTag: {
      borderWidth: 1,
      borderColor: theme.primary,
      color: theme.primary,
      fontSize: theme.fontSize.small,
      padding: "4 8" as any,
      borderRadius: 4,
      marginRight: 4,
      marginBottom: 4,
    },
    link: {
      color: theme.primary,
      textDecoration: "none" as const,
    },
    bullet: {
      fontSize: theme.fontSize.body,
      color: theme.foreground,
    },
  })
}

export type ResumeStyles = ReturnType<typeof createBaseResumeStyles>
```

**约束**：
- 此文件不可被任何模板直接修改
- 样式槽名称是 API——新增模板只覆盖，不删除现有槽
- `ResumeStyles` 类型导出供 Section 组件使用

---

#### 4.8.4 Gengar 模板样式 — `lib/pdf/templates/gengar/styles.ts`

**新建文件**：`lib/pdf/templates/gengar/styles.ts`

```typescript
import type { ResumeTheme } from "@/lib/pdf/types"
import { createBaseResumeStyles } from "@/lib/pdf/styles/base-styles"

const gengarTheme: ResumeTheme = {
  primary: "#2d2640",
  primaryTint: "#f5f2fa",
  background: "#ffffff",
  foreground: "#2d2640",
  mutedForeground: "#8a8099",
  fontFamily: "Helvetica",
  headingFontFamily: "Helvetica-Bold",
  fontSize: {
    name: 26,
    heading: 15,
    body: 10.5,
    small: 9,
  },
  spacing: {
    section: 16,
    paragraph: 10,
    item: 6,
  },
}

const base = createBaseResumeStyles(gengarTheme)

// 只覆盖 4 项差异样式
export const gengarStyles = {
  ...base,
  sectionHeading: {
    ...base.sectionHeading,
    borderBottomWidth: 1,
    borderBottomColor: gengarTheme.primary,
    paddingBottom: 4,
  },
  skillTag: {
    ...base.skillTag,
    backgroundColor: gengarTheme.primary,
    color: "#ffffff",
  },
}
```

---

#### 4.8.5 Gengar 模板组件 — `lib/pdf/templates/gengar/GengarTemplate.tsx`

**新建文件**：`lib/pdf/templates/gengar/GengarTemplate.tsx`

```typescript
import { Page, View, Text, Document } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { SectionRenderer } from "@/lib/pdf/components/SectionRenderer"
import { gengarStyles as s } from "./styles"

interface Props {
  resume: ResumeData
}

export function GengarTemplate({ resume }: Props) {
  const sidebarSections = resume.sections.filter(sec => sec.placement === "sidebar")
  const mainSections = resume.sections.filter(sec => sec.placement === "main")

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerName}>{resume.basics.name}</Text>
          <Text style={s.headerContact}>
            {resume.basics.title} · {resume.basics.email} · {resume.basics.phone}
          </Text>
        </View>

        {/* Body: 双栏布局 */}
        <View style={s.body}>
          <View style={s.sidebar}>
            {sidebarSections.map(section => (
              <SectionRenderer
                key={section.id}
                section={section}
                styles={s}
                placement="sidebar"
              />
            ))}
          </View>
          <View style={s.main}>
            {mainSections.map(section => (
              <SectionRenderer
                key={section.id}
                section={section}
                styles={s}
                placement="main"
              />
            ))}
          </View>
        </View>
      </Page>
    </Document>
  )
}
```

**约束**：
- 模板只负责声明"哪些 section 放 sidebar，哪些放 main"
- 模板不写任何内容渲染逻辑——全部交给 SectionRenderer
- Header 内容由模板控制（姓名、联系方式）

---

#### 4.8.6 Section 自动路由 — `lib/pdf/components/SectionRenderer.tsx`

**新建文件**：`lib/pdf/components/SectionRenderer.tsx`

```typescript
import type { ResumeSection, SectionType } from "@/lib/pdf/types"
import type { ResumeStyles } from "@/lib/pdf/styles/base-styles"
import { SummarySection } from "./SummarySection"
import { ExperienceSection } from "./ExperienceSection"
import { EducationSection } from "./EducationSection"
import { SkillsSection } from "./SkillsSection"
import { ProjectsSection } from "./ProjectsSection"
import { View } from "@react-pdf/renderer"

export interface SectionProps {
  section: ResumeSection
  styles: ResumeStyles
  placement: "sidebar" | "main"
}

const registry: Record<SectionType, React.ComponentType<SectionProps>> = {
  summary: SummarySection,
  experience: ExperienceSection,
  education: EducationSection,
  skills: SkillsSection,
  projects: ProjectsSection,
  languages: SkillsSection,      // 复用 SkillsSection，改 title
  certifications: SkillsSection,  // 复用 SkillsSection
}

export function SectionRenderer({ section, styles, placement }: SectionProps) {
  const Component = registry[section.type]
  if (!Component) return null
  return <Component section={section} styles={styles} placement={placement} />
}
```

---

#### 4.8.7 Section 组件 — `lib/pdf/components/*.tsx`

**新建文件**：共 5 个 Section 组件，统一放在 `lib/pdf/components/` 下

每个组件的 Props 接口完全相同：
```typescript
interface SectionProps {
  section: ResumeSection
  styles: ResumeStyles
  placement: "sidebar" | "main"
}
```

**需实现的 5 个组件**：

| 文件 | 渲染内容 | 特殊处理 |
|------|---------|---------|
| `SummarySection.tsx` | `section.items[0].description` | 无标题，直接渲染段落文本 |
| `ExperienceSection.tsx` | 标题行（item.title + item.date 右对齐）+ 副标题（item.subtitle 用 primary 色）+ item.description（STAR 描述）+ item.highlights（• 列表） | 每段间距 `spacingItem` |
| `EducationSection.tsx` | 同 ExperienceSection，但用 item.degree + item.gpa | — |
| `SkillsSection.tsx` | flexWrap 排列 item.title → 标签样式 | `placement === "sidebar"` 时用 `styles.skillTag`（填充色），否则 `styles.outlineTag`（边框） |
| `ProjectsSection.tsx` | 同 ExperienceSection，增加 item.url 渲染为 `<Link>` | url 截断 50 字符 |

**SkillsSection 的 placement 感知逻辑**（其余组件同理）：
```typescript
// 不在组件内写 if placement === "sidebar"，而是让调用方传入的 styles 已包含正确样式
// sidebar skillTag = 填充色 + 白字，main skillTag = 边框 + primary 色
```

**约束**：
- 所有 `<Text>` 组件不能省略，必须显式设置 `style` prop
- 不允许在 Section 组件内使用 `StyleSheet.create()`——样式统一来自 `styles` prop
- 每个 Section 组件文件不超过 60 行

---

#### 4.8.8 Agent 输出 → ResumeData 转换器 — `lib/pdf/mapper.ts`

**新建文件**：`lib/pdf/mapper.ts`

```typescript
import type { RewriteResult } from "@/lib/agent/types"
import type { ResumeData, ResumeSection } from "@/lib/pdf/types"

/**
 * 将 Agent C 的 RewriteResult 转换为 PDF 模板所需的 ResumeData
 * 这是"Agent 语义输出"到"模板结构化输入"的唯一桥梁
 */
export function rewriteResultToResumeData(result: RewriteResult, basics: {
  name: string
  title: string
  email: string
  phone: string
}): ResumeData {
  const sections: ResumeSection[] = []

  // 1. 个人总结 → summary section
  const summaryMod = result.modifications.find(m => m.section === "summary")
  if (summaryMod) {
    sections.push({
      id: "summary",
      type: "summary",
      title: "个人总结",
      placement: "main",
      items: [{ description: summaryMod.rewritten }],
    })
  }

  // 2. 工作经历 → experience section
  const expMods = result.modifications.filter(m => m.section === "experience")
  if (expMods.length > 0) {
    sections.push({
      id: "experience",
      type: "experience",
      title: "工作经历",
      placement: "main",
      items: expMods.map(m => ({
        title: m.section,
        description: m.rewritten,
        highlights: m.matchedKeywords.length > 0 ? m.matchedKeywords : undefined,
      })),
    })
  }

  // 3. 其余 section 从 rewrittenResumeMarkdown 解析
  // 此处用简易解析，后续版本增强

  return {
    basics,
    sections,
    metadata: {
      template: "gengar",
      generatedAt: new Date().toISOString(),
    },
  }
}
```

**约束**：
- 这是 Agent 和 PDF 模块之间唯一的耦合点
- 不在此文件内做任何下载/渲染/UI 操作
- `markdown` 字段不在此处处理——仅处理结构化数据

---

#### 4.8.9 模板注册表 — `lib/pdf/templates/index.ts`

**新建文件**：`lib/pdf/templates/index.ts`

```typescript
import type { ResumeData } from "@/lib/pdf/types"
import { GengarTemplate } from "./gengar/GengarTemplate"

type TemplateComponent = React.ComponentType<{ resume: ResumeData }>

const templateRegistry: Record<string, TemplateComponent> = {
  gengar: GengarTemplate as any,
}

export function getTemplate(name: string): TemplateComponent {
  const tpl = templateRegistry[name]
  if (!tpl) throw new Error(`Unknown template: ${name}`)
  return tpl
}

export { GengarTemplate }
```

---

#### 4.8.10 PDF 导出 API — `app/api/export-pdf/route.ts`

**新建文件**：`app/api/export-pdf/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { renderToStream } from "@react-pdf/renderer"
import { getTemplate } from "@/lib/pdf/templates"
import type { ResumeData } from "@/lib/pdf/types"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resumeData = body as ResumeData

    if (!resumeData?.metadata?.template) {
      return NextResponse.json({ error: "缺少 template 参数" }, { status: 400 })
    }

    const Template = getTemplate(resumeData.metadata.template)
    const stream = await renderToStream(<Template resume={resumeData} />)

    const fileName = `resume-${resumeData.basics?.name ?? "export"}.pdf`

    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (error) {
    console.error("PDF 导出失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 }
    )
  }
}
```

**约束**：
- 仅使用 `renderToStream`（服务端渲染），不使用 `renderToBlob`（客户端）
- 不在此路由中做数据转换——调用方传入已构造好的 `ResumeData`

---

#### 4.8.11 ResumePreview 集成导出按钮 — `components/resume-preview.tsx`

**文件**：`components/resume-preview.tsx`

**改动**：在现有"一键 Copy"按钮旁新增"导出 PDF"按钮：
```tsx
// 新增 props（可选，渐进式）
interface ResumePreviewProps {
  markdown: string
  isLoading?: boolean
  onExportPdf?: () => void     // 新增：父组件传入导出回调
  isExporting?: boolean         // 新增：导出 loading 状态
}

// 在 handleCopy 按钮同行新增：
<Button
  variant="outline"
  size="sm"
  onClick={onExportPdf}
  disabled={!markdown || isExporting}
  className="gap-1.5 rounded-full"
>
  <Download className="size-3.5" />
  {isExporting ? "导出中…" : "导出 PDF"}
</Button>
```

**约束**：
- 不改动现有"一键 Copy"按钮的行为和位置
- 导出按钮仅在 `onExportPdf` 传入时显示（渐进增强，不影响现有调用方）
- 导出 loading 期间"一键 Copy"按钮仍然可用（不互相阻塞）

---

#### 4.8.12 验收标准

- [ ] `npm run build` 无报错
- [ ] POST `/api/export-pdf` 传入合法 `ResumeData` JSON，返回有效 PDF 文件
- [ ] PDF 可在 Chrome/Edge/Acrobat 中正常打开，中文无乱码
- [ ] PDF 内容包含：Header（姓名+岗位+联系方式）、个人总结、工作经历（含 STAR 描述）、技能标签
- [ ] 缺少 `template` 参数时返回 `400 { error: "缺少 template 参数" }`
- [ ] 非法 `template` 名时返回 `500 { error: "Unknown template: xxx" }`
- [ ] ResumePreview 的"导出 PDF"按钮点击后触发下载
- [ ] 无文件时"导出 PDF"按钮为 disabled 状态
- [ ] 新增文件全部位于 `lib/pdf/` 下，不污染现有目录

---

### 4.9 模块依赖关系

```
4.7 空状态优化 ────┬──→ 可直接并行开发
                   │
4.8 PDF 导出 ──────┘

4.7 与 4.8 无代码冲突，可同时进行。
4.8 的 4.8.11（ResumePreview 集成）需等 4.8.1~4.8.10 完成后再做。
```

---

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-07 | 基于现有代码创建，建立三阶段 Agent 和 6 大模块框架 |
| 2026-08-07 | 新增 4.7 空状态优化（TrendChart + StatCard + 首次引导） |
| 2026-08-07 | 新增 4.8 PDF 导出（Gengar 模板，11 个子模块） |
| 2026-08-07 | 新增 4.9 模块依赖关系图 |
