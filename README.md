# Offer Match · 智能简历助手

基于 V0 设计的智能简历匹配工作台。上传简历与目标职位描述，AI 实时分析匹配度并生成专属投递策略。

## 技术栈

- **框架**: Next.js 16 + React 19
- **样式**: Tailwind CSS 4 + shadcn/ui
- **图表**: Recharts
- **主题**: next-themes（浅色 / 深色 / 跟随系统）

## 快速开始

```bash
# 1. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 OPENAI_API_KEY（切勿把真实 Key 提交到 Git）

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

## 隐私与安全（GitHub / Netlify 托管必读）

- **只提交** `.env.example`；真实密钥放在本地 `.env.local`（已被 `.gitignore` 忽略）
- **Netlify 部署必须单独配置环境变量**（仓库里的 `.env.local` 不会自动同步到线上）：
  1. 打开 [Netlify → offermatch → Environment variables](https://app.netlify.com/projects/offermatch/configuration/env)
  2. 添加（与本地 `.env.local` 一致）：
     - `OPENAI_API_KEY`（必填）
     - `OPENAI_BASE_URL`=`https://dashscope.aliyuncs.com/compatible-mode/v1`（通义千问）
     - `OPENAI_MODEL`=`qwen3.8-max`（或你的模型名）
  3. 保存后 **Trigger deploy → Clear cache and deploy site**
  4. 可用 `https://你的站点/api/health` 检查：`aiConfigured` 应为 `true`
- **不要提交** 用户反馈、简历原文、联系方式等本地数据（`data/` 已忽略）
- 简历与 JD 分析默认在浏览器本地 / 你的模型 API 侧处理；公开仓库前请确认未混入个人简历样本
- PostHog 等埋点为可选；未配置 `NEXT_PUBLIC_POSTHOG_KEY` 时不会上报

## 环境变量

在项目根目录创建 `.env.local`（参考 `.env.example`）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | ✅ | 大模型 API 密钥（阿里云百炼 / OpenAI 等） |
| `OPENAI_MODEL` | 否 | 模型名称，默认 `qwen3.7-plus` |
| `OPENAI_BASE_URL` | 否 | OpenAI 兼容端点；通义千问用 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `OCR_MAX_PAGES` | 否 | 扫描版 PDF OCR 最大页数，默认 `15` |
| `TESSERACT_LANG` | 否 | OCR 语言包，默认 `chi_sim+eng`（简中+英文） |
| `NEXT_PUBLIC_POSTHOG_KEY` | 否 | PostHog Project API Key；不填则关闭访问埋点 |
| `NEXT_PUBLIC_POSTHOG_HOST` | 否 | PostHog 地址，默认 `https://us.i.posthog.com` |
| `POSTHOG_PERSONAL_API_KEY` | 否 | 后台漏斗查询密钥，仅服务端使用，授予项目所需的查询读取权限 |
| `POSTHOG_PROJECT_ID` | 否 | 后台漏斗对应的 PostHog 项目 ID |
| `POSTHOG_API_HOST` | 否 | 查询 API 地址，默认 `https://us.posthog.com`；欧洲区填 `https://eu.posthog.com` |

后台大盘按所选时间范围分别统计各事件的独立用户数，不要求顺序转化。
上传人数仅包含文件解析成功事件；复制人数只包含剪贴板写入成功；PDF 下载指下载点击，不代表系统已确认文件保存。
首响应时间为开始分析到首个 SSE 业务事件的时间，完整分析耗时为开始到完成事件的时间，均显示有效样本量。
分析详情按每页 25 条分页覆盖全部已入库的 `source=model` 记录，排除示例兜底结果，不受大盘日期筛选限制。
详情通过 `analysis_id` 关联行为（历史开始/完成事件兼容 `session_id`），不按匿名用户猜测关联。
历史没有采集的行为以及缺失埋点标为未知；PostHog 保留期限、网络和拦截插件也会影响观测，无法追溯补齐。
新版本部署后才会采集新的分析 ID 与阶段耗时。验证报表逻辑：`node scripts/test-admin-analytics.cjs`。
| `NEXT_PUBLIC_SUPABASE_URL` | 否 | Supabase 项目 URL；配置后启用业务数据入库 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 否 | Supabase publishable key；预留给后续前端 SDK |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | Supabase 服务端密钥，仅放服务端环境变量 |
| `ADMIN_PASSWORD` | 否 | `/admin` 用户数据后台访问密码 |

### PostHog 匿名访问数据

无需用户注册即可在 PostHog 查看访客与漏斗：

1. 在 [PostHog](https://us.posthog.com) 创建项目，复制 Project API Key
2. 写入 `.env.local` 的 `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`
3. 重启 `npm run dev` 后，在 PostHog → Activity / Persons 查看匿名访客

已埋点事件：`analysis_*`、`interview_*`、`resume_uploaded`、`jd_uploaded`、`pdf_exported`、`templates_viewed`。**不会**上报完整 JD / 简历正文。

### Supabase 用户数据后台

为了快速完成前 100 个用户的产品闭环，项目内置了一个轻量后台：

- `POST /api/analysis-sessions`：保存一次分析结果的关键业务数据
- `POST /api/feedback`：优先保存到 Supabase；未配置时回退到本地 `data/feedback.jsonl`
- `/admin`：查看最近分析、今日分析、独立访客和可回访反馈

配置步骤：

1. 在 Supabase 新建项目
2. 打开 SQL Editor，执行 [supabase/schema.sql](supabase/schema.sql)
3. 在部署平台配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
ADMIN_PASSWORD=your-admin-password
```

4. 重新部署后访问 `/admin`

MVP 阶段所有后台读写都通过 Next.js 服务端的 `service_role` key 完成，浏览器端不会直接读取 Supabase 业务表。分析记录默认保存岗位、分数、JD 摘要和 AI 结果；原始 JD / 简历全文仍保留在用户本机历史中。

### 通义千问（百炼）配置示例

```bash
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=qwen3.7-plus
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

Key 获取：https://bailian.console.aliyun.com/

## 文档解析

`POST /api/parse-document` — 支持 PDF / Word / TXT 上传：

- 文字版 PDF：直接提取文本
- **扫描版 PDF**：自动 fallback 到 Tesseract OCR（中英文）
- 首次 OCR 会下载语言包，单文件约需 30–90 秒

## API 架构

`POST /api/chat` — 三阶段 Agent 流式分析：

- **阶段 A**：JD 深度解析 → 理想候选人画像
- **阶段 B**：逆向推导 → 理想简历大纲
- **阶段 C**：差异化重写 → 匹配度评分 + STAR 简历

可选 `POST /api/interview` — 阶段 D 模拟面试题与示范回答。

请求体：
```json
{ "jd": "岗位描述文本", "resume": "用户简历文本（可选）" }
```

响应为 SSE 流（`text/event-stream`），事件类型：`phase` | `reasoning`（可选） | `result` | `done` | `error`。A/B/C 阶段默认不推送模型原始 JSON，前端仅展示阶段进度文案。

## 项目结构

```
app/
  api/chat/       # Agent API Route Handler
  api/interview/  # 模拟面试 API
  page.tsx        # 主页面
lib/
  agent/          # 多阶段 Agent 逻辑、Prompt、SSE、降级内容
  hooks/          # 前端流式消费 Hook
components/       # UI 组件
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |
