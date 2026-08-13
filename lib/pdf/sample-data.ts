import type { ResumeData } from "@/lib/pdf/types"

/** 证件照占位图（80×104 PNG data URL），用于模板预览联调 */
export const SAMPLE_PHOTO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABoCAYAAABmOHdtAAABXElEQVR4nO3bsU1EQRBEwQuRIAgMk0AIBhsJBwdi4PR3uuerjOdPl737+P76+dXzPdIHbA8gQICrAwgQ4OoAAgS4OoAAAa4OIECAq6sB/Px4/3fpm+OAz6C1YUYAr4RLQ44DnsRLII4CTuBNI44ATsJNQx4HTOJNIAJsBkzDTSAeA0yDTSEeAUxDTSICbANMA00jAgR4I8A0TAIRIECAAAECBAgQIECAAAEC3FIl4BbEK/cCBHgzwHbEq7cCbARsRTyx08uEZsAWxJP7ALYDphFPb/NCdRPgFOLkHq/0NwKegExt8FPpLoBbAwgQ4OoAAgS4OoAAAa4O4DTgy+vb7QPYCpge1ogIEOASwPSgVkSAE4DpIc2IAAGWA6YHNAQwBZg+vCmAAJcBpg9uDOAUYPrQ5gACLAdMH7ghgKcA04dtCiDAMsD0QRsDeBVg+pDNAQQYBkwfsD2AALP9Abiz2+pEaW4fAAAAAElFTkSuQmCC"

/** 完整简历（含照片）—— 三模板视觉验收用 */
export function createFullSampleResume(
  template: string = "minimal"
): ResumeData {
  return {
    basics: {
      name: "陈亦帆",
      title: "高级前端工程师",
      email: "chenyifan@example.com",
      phone: "13800138000",
      location: "上海",
      website: "https://chenyifan.dev",
      github: "github.com/chenyifan",
      linkedin: "linkedin.com/in/chenyifan",
      photo: SAMPLE_PHOTO_DATA_URL,
    },
    sections: [
      {
        id: "summary",
        type: "summary",
        title: "个人总结",
        placement: "main",
        items: [
          {
            description:
              "8 年前端经验，擅长 React / TypeScript 与复杂 B 端系统设计。主导过多次核心链路重构，关注性能、可维护性与交付质量。",
          },
        ],
      },
      {
        id: "experience",
        type: "experience",
        title: "工作经历",
        placement: "main",
        items: [
          {
            title: "高级前端工程师",
            subtitle: "星云科技",
            date: "2022.03 - 至今",
            location: "上海",
            highlights: [
              "主导招聘工作台前端架构，首屏加载时间下降 42%",
              "搭建组件库与设计令牌，跨 6 个业务线复用",
              "推动 TypeScript 全量迁移与 CI 质量门禁",
            ],
          },
          {
            title: "前端工程师",
            subtitle: "云图互动",
            date: "2019.07 - 2022.02",
            location: "杭州",
            highlights: [
              "负责增长中台可视化编辑器，周活提升 28%",
              "落地微前端方案，独立部署周期缩短至 1 天内",
            ],
          },
        ],
      },
      {
        id: "projects",
        type: "projects",
        title: "项目经历",
        placement: "main",
        items: [
          {
            title: "OfferMatch 智能简历助手",
            subtitle: "个人项目",
            date: "2026",
            highlights: [
              "Next.js + Agent 流水线完成 JD 匹配与简历改写",
              "实现多模板 PDF 导出与证件照渲染",
            ],
          },
        ],
      },
      {
        id: "education",
        type: "education",
        title: "教育背景",
        placement: "main",
        items: [
          {
            title: "华东理工大学",
            degree: "计算机科学与技术 · 本科",
            date: "2015 - 2019",
            gpa: "GPA 3.7",
            description: "主修数据结构、操作系统、计算机网络",
          },
        ],
      },
      {
        id: "skills",
        type: "skills",
        title: "技能",
        placement: "sidebar",
        items: [
          { title: "React", subtitle: "框架" },
          { title: "TypeScript", subtitle: "框架" },
          { title: "Next.js", subtitle: "框架" },
          { title: "Node.js", subtitle: "工程" },
          { title: "性能优化", subtitle: "工程" },
          { title: "设计系统", subtitle: "工程" },
        ],
      },
      {
        id: "languages",
        type: "languages",
        title: "语言",
        placement: "sidebar",
        items: [
          { title: "中文", subtitle: "母语" },
          { title: "英语", subtitle: "流利" },
        ],
      },
      {
        id: "awards",
        type: "awards",
        title: "荣誉奖项",
        placement: "main",
        items: [
          { title: "公司年度技术创新奖（2024）" },
          { title: "开源贡献者 · React 生态" },
        ],
      },
    ],
    metadata: {
      template,
      generatedAt: new Date().toISOString(),
    },
  }
}

/** 缺失教育 + 项目（及部分空联系方式）—— 验证空字段不塌陷 */
export function createSparseSampleResume(
  template: string = "minimal"
): ResumeData {
  return {
    basics: {
      name: "林晓桐",
      title: "产品设计师",
      email: "linxt@example.com",
      phone: "",
      location: "深圳",
    },
    sections: [
      {
        id: "summary",
        type: "summary",
        title: "个人总结",
        placement: "main",
        items: [
          {
            description:
              "5 年 B 端与增长产品设计经验，擅长信息架构与跨职能协作。",
          },
        ],
      },
      {
        id: "experience",
        type: "experience",
        title: "工作经历",
        placement: "main",
        items: [
          {
            title: "高级产品设计师",
            subtitle: "青柠设计",
            date: "2021.05 - 至今",
            highlights: [
              "负责商家后台改版，任务完成时长下降 35%",
              "建立设计规范，支撑 3 个产品线一致性交付",
            ],
          },
        ],
      },
      {
        id: "skills",
        type: "skills",
        title: "技能",
        placement: "sidebar",
        items: [
          { title: "Figma" },
          { title: "用户研究" },
          { title: "原型设计" },
        ],
      },
    ],
    metadata: {
      template,
      generatedAt: new Date().toISOString(),
    },
  }
}
