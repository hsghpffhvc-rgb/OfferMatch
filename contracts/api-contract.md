# OfferMatch 接口契约

> ⚠️ 本文档是强制约束，不是建议。所有代码生成必须遵守。

---

## 全局约束

### API 路由规范

- 框架：Next.js 16 App Router（文件路径即路由路径）
- API Route 文件统一命名为 `route.ts`
- SSE 事件格式见下方定义，不可擅自变更

---

## SSE 事件格式（冻结，不可变更）

所有 Agent 分析结果通过 Server-Sent Events 流式传输，事件类型定义见 `lib/agent/types.ts`：

```typescript
type StreamEvent =
  | { type: "phase"; phase: "A"|"B"|"C"; status: "start"|"streaming"|"complete"|"error"; message?: string }
  | { type: "reasoning"; phase: "A"|"B"|"C"; content: string }
  | { type: "result"; phase: "A"|"B"|"C"; data: PersonaResult | OutlineResult | RewriteResult }
  | { type: "done"; data: AgentAnalysisResult }
  | { type: "interview_done"; data: InterviewResult }
  | { type: "error"; message: string; phase?: "A"|"B"|"C" }
```

---

## 已实现接口

### POST /api/chat

| 项目 | 说明 |
|------|------|
| 描述 | 三阶段 Agent 流式分析（核心接口） |
| 请求 | `{ jd: string, resume: string }` |
| 响应 | SSE stream，事件序列：phase(A) → result(A) → phase(B) → ... → done。A/B/C 与面试接口一致：不向客户端流式推送模型原始 JSON；`reasoning` 事件可选，仅用于自然语言进度（若有）。 |
| 文件 | `app/api/chat/route.ts` |

### POST /api/parse-document

| 项目 | 说明 |
|------|------|
| 描述 | 上传并解析 PDF/Word/TXT 简历文件 |
| 请求 | `multipart/form-data: { file: File }` |
| 响应 | `{ text: string, fileName: string, pageCount?: number }` |
| 文件 | `app/api/parse-document/route.ts` |

### POST /api/interview

| 项目 | 说明 |
|------|------|
| 描述 | 基于 JD 与简历证据生成 3-5 道面试预测题；不进行用户作答或多轮对话。 |
| 请求 | `{ jd: string, context: InterviewContext }`。`context` 只传岗位相关技能与最多 4 段可验证经历，不传完整 Markdown、评分或修改记录。 |
| 响应 | SSE stream：`phase(D)` → `result(D)` → `interview_done`。加载过程不得向客户端发送模型原始 JSON。 |
| 结果 | `{ questions: [{ id, category, difficulty, question, intent, referenceAnswer, answerStrategy, personalizedBridge }] (3-5题), preparationChecklist: string[3] }`。每题以 300-400 字可朗读示范话术为核心；`personalizedBridge` 格式为「用你【公司|职位】的XX经历替换…」。 |
| 文件 | `app/api/interview/route.ts` |

---

## 待开发接口

> 以下接口规格在开发前必须在此文档中最终确认。

### POST /api/score-multi

| 项目 | 说明 |
|------|------|
| 优先级 | P0 |
| 依赖 | 无 |
| 描述 | 六维雷达图评分分析 |
| 请求 | `{ jd: string, resume: string }` |
| SSE 事件 | `{ type: "result", phase: "score", data: { overall, skillMatch, experienceMatch, educationMatch, clarity, atsCompatibility } }` |

### GET /api/profile

| 项目 | 说明 |
|------|------|
| 优先级 | P0 |
| 依赖 | 无 |
| 描述 | 获取用户职业档案（历史记录、技能树等） |
| 响应 | `{ history: [], savedResumes: [], skills: [], workTimeline: [] }` |

---

## 变更记录

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-07 | 基于现有代码创建，冻结 SSE 事件格式和 2 个已有接口 | — |
| 2026-08-12 | 新增 `/api/interview`，使用紧凑证据上下文与独立完成事件 | 面试预测调用方 |
