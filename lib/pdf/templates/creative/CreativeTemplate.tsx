import { Document, Page, View, Text, Image } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { creativeStyles as s } from "./styles"
import {
  getItems,
  getSummary,
  getAwards,
  getSkillGroups,
  getLanguages,
  getHighlights,
} from "../section-helpers"

/**
 * 设计感模板 —— 翻译自 V0 的 creative-resume.tsx
 * 左侧深色信息栏 + 右侧主内容
 * 图标用文字缩写替代（react-pdf 不支持 lucide-react）
 * 面向设计 / 创意类岗位
 */

// V0 用 lucide 图标，react-pdf 不支持，用首字替代
const ICON_MAP: Record<string, string> = {
  "关于我": "关",
  "工作经历": "历",
  "项目经历": "项",
  "荣誉奖项": "誉",
}

export function CreativeTemplate({ resume }: { resume: ResumeData }) {
  const { basics } = resume
  const summary = getSummary(resume)
  const experiences = getItems(resume, "experience")
  const projects = getItems(resume, "projects")
  const education = getItems(resume, "education")
  const skillGroups = getSkillGroups(resume)
  const awards = getAwards(resume)
  const languages = getLanguages(resume)

  const contactItems = [
    { label: "电话", value: basics.phone },
    { label: "邮箱", value: basics.email },
    { label: "地址", value: basics.location },
    { label: "网站", value: basics.website },
    { label: "GitHub", value: basics.github },
    { label: "LinkedIn", value: basics.linkedin },
  ].filter((c) => c.value && c.value.trim())

  const educationItems = education.filter(
    (edu) =>
      !(
        edu.description &&
        (edu.title?.trim() === edu.description.trim() ||
          edu.degree?.trim() === edu.description.trim())
      ),
  )

  const MainTitle = ({ children }: { children: string }) => (
    <View style={s.mainTitleRow}>
      <View style={s.mainTitleIcon}>
        <Text style={s.mainTitleIconText}>{ICON_MAP[children] ?? "•"}</Text>
      </View>
      <Text style={s.mainTitle}>{children}</Text>
    </View>
  )

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
      {/* ===== Left Sidebar ===== */}
      <View fixed style={s.sidebar}>
        {/* Photo + Name */}
        <View style={s.sidebarCenter}>
          {basics.photo ? (
            <Image src={basics.photo} style={s.photo} />
          ) : null}
          <Text style={s.sidebarName}>{basics.name}</Text>
          <Text style={s.sidebarTitle}>{basics.title}</Text>
        </View>

        {/* Contact */}
        {contactItems.length > 0 ? (
          <View style={s.sidebarSection}>
            <Text style={s.sidebarTitle2}>联系方式</Text>
            {contactItems.map((c, i) => (
              <View key={i} style={s.contactItem}>
                <Text style={s.contactLabel}>{c.label}</Text>
                <Text style={s.contactValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Education */}
        {educationItems.length > 0 ? (
          <View style={s.sidebarSection}>
            <Text style={s.sidebarTitle2}>教育背景</Text>
            {educationItems.map((edu, i) => (
              <View key={i} style={s.eduItem}>
                {edu.title ? <Text style={s.eduSchool}>{edu.title}</Text> : null}
                {edu.degree ? <Text style={s.eduDegree}>{edu.degree}</Text> : null}
                {edu.date ? <Text style={s.eduPeriod}>{edu.date}</Text> : null}
                {edu.description &&
                edu.description.trim() !== edu.title?.trim() &&
                edu.description.trim() !== edu.degree?.trim() ? (
                  <Text style={s.eduDetail}>{edu.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Skills */}
        {skillGroups.length > 0 ? (
          <View style={s.sidebarSection}>
            <Text style={s.sidebarTitle2}>专业技能</Text>
            {skillGroups.map((grp, i) => {
              const pills = grp.items.filter((item) => item.trim())
              if (pills.length === 0) return null
              return (
                <View key={i} style={s.skillGroup}>
                  {grp.group ? (
                    <Text style={s.skillGroupTitle}>{grp.group}</Text>
                  ) : null}
                  <View style={s.pillRow}>
                    {pills.map((item, j) => (
                      <Text key={j} style={s.pill}>{item}</Text>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>
        ) : null}

        {/* Languages */}
        {languages.length > 0 ? (
          <View style={s.sidebarSection}>
            <Text style={s.sidebarTitle2}>语言</Text>
            {languages.map((l, i) => (
              <View key={i} style={s.langRow}>
                <Text style={s.langName}>{l.name}</Text>
                <Text style={s.langLevel}>{l.level}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ===== Right Main Content ===== */}
      <View style={s.main}>
        {/* About */}
        {summary ? (
          <View style={s.mainSection}>
            <MainTitle>关于我</MainTitle>
            <Text style={s.summaryText}>{summary}</Text>
          </View>
        ) : null}

        {/* Experience */}
        {experiences.length > 0 ? (
          <View style={s.mainSection}>
            <MainTitle>工作经历</MainTitle>
            {experiences.map((exp, i) => (
              <View key={i} style={s.expItem} wrap={false}>
                <View style={s.expTitleRow}>
                  <Text style={s.expTitle}>{exp.title}</Text>
                  {exp.date ? <Text style={s.expDate}>{exp.date}</Text> : null}
                </View>
                {exp.subtitle ? (
                  <Text style={s.expSub}>
                    {exp.subtitle}
                    {exp.location ? `  ·  ${exp.location}` : ""}
                  </Text>
                ) : null}
                {getHighlights(exp).map((point, j) => (
                  <View key={j} style={s.bulletItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.bulletText}>
                      {point.title ? <Text style={s.bulletTitle}>{point.title} </Text> : null}
                      {point.text}
                    </Text>
                  </View>
                ))}
                {exp.description && getHighlights(exp).length === 0 ? (
                  <Text style={s.bulletText}>{exp.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Projects */}
        {projects.length > 0 ? (
          <View style={s.mainSection}>
            <MainTitle>项目经历</MainTitle>
            {projects.map((proj, i) => (
              <View key={i} style={s.expItem} wrap={false}>
                <View style={s.expTitleRow}>
                  <Text style={s.expTitle}>
                    {proj.title}
                    {proj.subtitle ? `  ·  ${proj.subtitle}` : ""}
                  </Text>
                  {proj.date ? <Text style={s.expDate}>{proj.date}</Text> : null}
                </View>
                {getHighlights(proj).map((point, j) => (
                  <View key={j} style={s.bulletItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.bulletText}>
                      {point.title ? <Text style={s.bulletTitle}>{point.title} </Text> : null}
                      {point.text}
                    </Text>
                  </View>
                ))}
                {proj.description && getHighlights(proj).length === 0 ? (
                  <Text style={s.bulletText}>{proj.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Awards */}
        {awards.length > 0 ? (
          <View style={s.mainSection}>
            <MainTitle>荣誉奖项</MainTitle>
            {awards.map((award, i) => (
              <View key={i} style={s.bulletItem}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.bulletText}>{award}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Page>
    </Document>
  )
}
