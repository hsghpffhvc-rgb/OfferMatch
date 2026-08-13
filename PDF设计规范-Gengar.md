# OfferMatch 简历 PDF 模板设计规范 — Gengar 极简风

> 基于 Reactive Resume Gengar 模板架构提炼，可直接在 Cursor Chat 中用 `@PDF设计规范-Gengar.md` 加载。
> 
> **配套文档**：`@SDD.md` 第 4.8 节（PDF 导出的技术规格 + 代码接口）——两个文档配合使用。

---

## 一、设计哲学

Gengar 是 Reactive Resume 15 套模板中代表性的"极简专业风"。核心哲学：

### 1. 一套骨架，多套皮肤
15 个模板共用 20+ 个样式槽（text, heading, link, border, spacing…），每个模板只覆盖差异项。Gengar 只改了 **sidebar 颜色、header 背景、section heading 装饰线** 这 3 项，其他 17 项全继承默认值。

**对 OfferMatch 的意义**：MVP 阶段先做 1 套（Gengar），加第 2 套只需 ~30 行代码。

### 2. 模板只负责布局，不负责内容
模板组件只定义"sidebar 放左边、main 放右边、header 在上面"。具体渲染什么由 `SectionRenderer` 自动路由接管。加新 section（如"项目经历"）不需要改任何模板。

### 3. Placement 感知
同一个 `SummarySection` 放在 sidebar 里自动用 sidebar 配色/字号；放 main 里自动切到主区域排版。**不复制两套组件**，位置决定样式。

---

## 二、三层架构

```
┌─────────────────────────────────────────────┐
│  上层：数据模型                                │
│  lib/agent/types.ts → lib/pdf/types.ts       │
│  Agent C 输出 → mapper.ts → ResumeData        │
├─────────────────────────────────────────────┤
│  中层：模板组件                                │
│  GengarTemplate.tsx（~60行）                  │
│  定义 Header + 双栏布局                       │
│  sidebar: skills/languages/certs              │
│  main: summary/experience/education/projects  │
├─────────────────────────────────────────────┤
│  底层：样式工厂                                │
│  createBaseResumeStyles(theme) → 20+ 样式槽   │
│  Gengar 只覆盖 3-4 项差异                     │
│  Section 组件通过 styles prop 接收所有样式     │
└─────────────────────────────────────────────┘
```

---

## 三、Gengar 模板视觉规范

### 3.1 色彩

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 (primary) | `#2d2640` | Header 背景、Section 标题色 |
| 主色淡色 (primaryTint) | `#f5f2fa` | Sidebar 背景 |
| 背景 (background) | `#ffffff` | 页面底色 |
| 前景 (foreground) | `#2d2640` | 正文文字色 |
| 次要文字 | `#8a8099` | 日期、地点等辅助信息 |
| Header 文字 | `#ffffff` | Header 内姓名和联系方式 |
| Sidebar 标签 | `#2d2640` 底 + `#ffffff` 字 | 技能标签填充色反色 |

### 3.2 字体

| 元素 | 字号 | 字体 |
|------|------|------|
| 姓名 | 26pt | Helvetica-Bold |
| 章节标题 | 15pt | Helvetica-Bold |
| 正文 | 10.5pt | Helvetica |
| 小字（日期/地点/标签） | 9pt | Helvetica |

### 3.3 间距

| 元素 | 间距 |
|------|------|
| Section 间 | 16pt |
| 段落间 | 10pt |
| 列表项间 | 6pt |
| Header 内边距 | 28pt |
| Sidebar 内边距 | 20pt |
| Main 内边距 | 24pt |

### 3.4 布局

| 属性 | 值 |
|------|------|
| 纸张 | A4 (210 × 297mm) |
| Sidebar 宽度 | 30% |
| Main 宽度 | 70% |
| Section heading 底线 | 1px solid primary |
| 标签样式（sidebar） | 填充色 + 白字 + 4px 圆角 |
| 标签样式（main） | 边框 + primary 色 + 4px 圆角 |

---

## 四、Section 自动路由：Placement 感知

**核心原则**：Section 组件不写 `if (placement === "sidebar")`，而是由调用方传入的 styles 已包含正确样式。

### 4.1 路由表

```typescript
const registry: Record<SectionType, React.ComponentType<SectionProps>> = {
  summary: SummarySection,       // 个人总结
  experience: ExperienceSection,  // 工作经历（含 STAR 描述）
  education: EducationSection,    // 教育背景
  skills: SkillsSection,          // 技能标签
  projects: ProjectsSection,      // 项目经历
  languages: SkillsSection,       // 复用技能组件
  certifications: SkillsSection,  // 复用技能组件
}
```

### 4.2 Placement 如何影响渲染

| Section | Sidebar 行为 | Main 行为 |
|---------|-------------|-----------|
| SkillsSection | 标签填充色 + 白字 (`styles.skillTag`) | 标签边框 + primary 色 (`styles.outlineTag`) |
| ExperienceSection | 不显示日期右对齐（空间不够） | 标题左 + 日期右对齐 |
| SummarySection | 不显示（sidebar 无个人总结） | 渲染完整段落 |
| EducationSection | 简洁列表 | 含 GPA、专业、时间 |

**关键**：样式差异写在 `styles` prop 里，Section 组件代码完全一样，不改一行。

---

## 五、数据流：Agent C → PDF

```
Agent C RewriteResult
     │
     ▼
mapper.ts (rewriteResultToResumeData)
     │
     ▼
ResumeData { basics, sections[], metadata }
     │
     ├──→ GengarTemplate.tsx (布局)
     │         │
     │         ▼
     │    SectionRenderer (路由)
     │         │
     │    ┌────┴────────────┬─────────┐
     │    ▼                 ▼         ▼
     │  SummarySection  SkillsSection  ...
     │
     └──→ app/api/export-pdf/route.ts (renderToStream → PDF)
```

**mapper.ts 是 Agent 模块和 PDF 模块之间唯一的耦合点**——Agent 输出格式变了，只改这一个文件。

---

## 六、Section 组件 Props 契约

所有 Section 组件共用同一套 Props：

```typescript
interface SectionProps {
  section: ResumeSection    // 数据
  styles: ResumeStyles       // 样式（已包含 placement 感知的样式）
  placement: "sidebar" | "main"  // 位置
}
```

每个组件的渲染规则：

| 组件 | 主要渲染内容 | 不做什么 |
|------|-------------|---------|
| **SummarySection** | `section.items[0].description` | 不显示标题 |
| **ExperienceSection** | 标题行（title + date 右对齐）→ 副标题（subtitle 用 primary 色）→ description（STAR）→ highlights（• 列表） | 不渲染 GPA/学位 |
| **EducationSection** | 同 ExperienceSection，额外渲染 degree + gpa | 不渲染 STAR 描述 |
| **SkillsSection** | flexWrap 排列 item.title → 用 `styles.skillTag` 或 `styles.outlineTag` 包裹 | 不渲染描述文字 |
| **ProjectsSection** | 同 ExperienceSection + url 渲染为 `<Link>` | url 超过 50 字符需截断 |

### 必须遵守的约束

1. 每个 Section 组件文件 **≤ 60 行**
2. **禁止**在 Section 组件内调用 `StyleSheet.create()`——样式 100% 来自 `styles` prop
3. 所有 `<Text>` 组件**必须**显式设置 `style` prop
4. 不导入 `ResumeTheme`——只依赖 `styles` prop

---

## 七、在 Cursor 中的开发流程

### SDD.md 和本规范的关系

| 看 SDD.md（第 4.8 节） | 看本规范 |
|------------------------|---------|
| 精确的代码签名和文件路径 | 设计为什么这样做 |
| API 接口的输入/输出格式 | 视觉规范和色彩字号 |
| Props 接口的类型定义 | Section 路由的 placement 逻辑 |
| 验收标准 checklist | 代码组织原则和反模式 |

### 推荐方式：两个文档一起加载

在 Cursor Chat 中输入：

```
@SDD.md @PDF设计规范-Gengar.md @.OfferRules

我要实现 PDF 导出功能，按 4.8 节的规格从 4.8.1 开始。
先从安装依赖和写 lib/pdf/types.ts 开始。
```

然后按 SDD.md 的子模块顺序逐段推进：

```
# 第 1 段：安装依赖 + 数据模型
@SDD.md 按 4.8.1 和 4.8.2，安装 @react-pdf/renderer 并创建 lib/pdf/types.ts

# 第 2 段：基础样式工厂
@SDD.md 按 4.8.3，创建 lib/pdf/styles/base-styles.ts

# 第 3 段：Gengar 模板
@SDD.md 按 4.8.4 和 4.8.5，创建 Gengar 样式和模板组件
（本规范第三章的视觉规范在这里作为参考——告诉 AI "字号 26pt/15pt/10.5pt，Sidebar 30%"）

# 第 4 段：Section 组件
@SDD.md 按 4.8.6 和 4.8.7，创建 SectionRenderer + 5 个 Section 组件
（本规范第四章的路由表 + Placement 逻辑在这里作为参考）

# 第 5 段：mapper + API + 按钮集成
@SDD.md 按 4.8.8 到 4.8.11，创建 mapper → API Route → ResumePreview 导出按钮
```

### 什么时候只用 SDD.md，什么时候需要加载本规范

| 场景 | 加载哪个 |
|------|---------|
| 创建类型定义、写 API Route | 只用 SDD.md |
| 写模板视觉样式（字号/颜色/间距） | SDD.md + 本规范 |
| 写 Section 组件渲染逻辑 | SDD.md + 本规范 |
| 写 placement 感知逻辑 | 本规范（SDD.md 里没有这个细节） |
| 排错/调整渲染效果 | 本规范 + 截图对比 |

---

## 八、常见陷阱

| 陷阱 | 现象 | 对策 |
|------|------|------|
| Section 里写 `StyleSheet.create()` | 模板换了但 Section 样式不变 | 样式 100% 从 `styles` prop 来 |
| 模板里硬编码 section 列表 | 加新 section 要改模板 | 用 sidebarSections/mainSections 动态过滤 |
| Placement 判断写在 Section 里 | `if (placement === "sidebar")` 散落各处 | 通过 `styles.skillTag` vs `styles.outlineTag` 自动区分 |
| mapper.ts 里做下载操作 | 改一个映射函数，导出断了 | mapper 只做数据转换 |
| `@react-pdf/renderer` v4.x | Next.js 16 不兼容 | 锁定 v3.x 版本 |
| 中文字体不嵌入 | PDF 中文显示为方块 | 注册 Noto Sans SC 字体文件 |

---

## 版本

| 日期 | 说明 |
|------|------|
| 2026-08-07 | 基于 Reactive Resume Gengar 模板 v5.2 架构提炼，适配 OfferMatch Next.js 16 + React 19 技术栈 |
