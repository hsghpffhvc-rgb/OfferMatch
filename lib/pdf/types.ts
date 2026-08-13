// ===== 基础信息 =====
export interface ResumeBasics {
  name: string
  title: string // 目标岗位
  email: string
  phone: string
  location?: string
  linkedin?: string
  github?: string
  website?: string
  photo?: string // 证件照/头像路径（base64 或 URL），留空则模板自动隐藏
}

// ===== 章节定义 =====
export type SectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "languages"
  | "certifications"
  | "awards"

export type SectionPlacement = "sidebar" | "main"

export interface ResumeHighlight {
  title?: string
  text: string
}

export interface ResumeSectionItem {
  title?: string // 职位/学校/技能名
  subtitle?: string // 公司/专业
  date?: string // 时间范围
  location?: string
  description?: string // STAR 描述（Agent C 输出）
  highlights?: Array<ResumeHighlight | string> // 要点列表；兼容旧 string 数据
  url?: string
  level?: number // 技能熟练度 0-5
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
