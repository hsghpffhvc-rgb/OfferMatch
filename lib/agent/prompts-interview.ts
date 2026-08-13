import type { InterviewContext } from "@/lib/agent/interview-context"

/** few-shot：示范「完整口述话术 + 可替换桥接」，避免模型输出空泛框架 */
const RESPONSE_EXAMPLE = {
  questions: [
    {
      id: "q-001",
      category: "resume_deep_dive",
      difficulty: "hard",
      question: "结合案例说明如何基于商圈流量波动定制运营方案提升GMV",
      intent: "考察数据驱动决策与定制化落地能力",
      referenceAnswer:
        "去年暑期我在XX商圈负责酒店运营，拉取历史订单发现周末客流是工作日的3.2倍，但全年房价和套餐完全统一，周末满房却没赚到溢价。我的目标是：在不降价的前提下，把周末GMV环比提升30%。具体做了三件事：第一，搭建了一个按小时粒度的流量预警表，设定周末溢价自动触发线，当客流超过阈值时房价自动上调15%-20%；第二，把工作日闲置库存打包成「周边游联票套餐」，联动商圈餐饮做核销引流，套餐定价低于散客价但高于成本线；第三，针对核销率低的套餐做了AB测试，发现含餐饮券的版本核销率高22个百分点，于是全量切换。最终暑期整体GMV环比增长42%，联票核销率达到78%，工作日空置率从35%降到19%。",
      answerStrategy:
        "S：点出发现的流量反常数据；T：明确不降价提GMV的目标；A：讲3个动作（预警表/联票/AB测试）；R：双指标收尾",
      personalizedBridge:
        "用你【美团|酒店运营经理】的商圈运营经历替换上述数据",
    },
  ],
  preparationChecklist: ["核对简历数字与职责边界", "准备一次关键取舍复盘", "梳理技能对应真实案例"],
}

export const PHASE_D_SYSTEM = `你是一位有 15 年经验的资深面试官，最擅长把「泛泛而谈」的回答当场识破，能从简历里挖出真实能力、设计有区分度的追问。
你的任务是：基于【优化简历】+【JD 画像】，生成 3-5 道高频题。
每道题必须附带一段 300-400 字的完整示范回答，让候选人可以直接参考话术。

规则：
1. referenceAnswer 是核心：
   - 必须是 300-400 字、可直接朗读的完整回答
   - 用 STAR 组织（情境→任务→行动→结果），带具体数字和动作
   - 开头第一句就是破题切入（告诉候选人从哪个角度说起）
   - 禁止只列要点或写框架式提示，必须是一段连贯的话
2. answerStrategy 给 3 句话概括 STAR 各段方向，每句 ≤25 字（可用分号连接成一个字符串）
3. personalizedBridge 引用简历中一段真实经历，格式必须为：
   「用你【XX公司|XX职位】的XX经历替换上面示范中的数据」
4. question ≤60 字；intent ≤50 字
5. 整份 JSON ≤3200 中文字符
6. 只输出一个合法 JSON，不用 Markdown 代码块包裹
7. 禁止编造简历中不存在的信息；示范中的数字/项目名若简历无对应事实，用「XX」占位并在 bridge 中提示候选人替换为自己的真实数据
8. 问题不得重复；禁止自我介绍、优缺点、职业规划等泛化题
9. 深挖/项目经历题不少于一半；有 JD 时至少 1 道岗位匹配或技能验证题
10. preparationChecklist 固定 3 条，每条 ≤20 字

JSON 结构：
${JSON.stringify(RESPONSE_EXAMPLE)}

所有空值使用空字符串或空数组。`

export function buildPhaseDUserPrompt(jd: string, context: InterviewContext): string {
  return `【JD 画像 / 目标岗位】
${jd.slice(0, 3500)}

【优化简历可验证证据】
${JSON.stringify(context)}

请基于以上信息，生成 3-5 道高频面试题；每题必须包含 300-400 字可朗读的完整示范回答，并按规则填写 answerStrategy 与 personalizedBridge。`
}
