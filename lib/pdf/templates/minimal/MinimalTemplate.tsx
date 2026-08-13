import { Document, Page, View, Text, Image } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { minimalStyles as s } from "./styles"
import {
  getItems,
  getSummary,
  getAwards,
  getSkillGroups,
  getHighlights,
} from "../section-helpers"

/**
 * 极简风格模板 —— 翻译自 V0 的 minimal-resume.tsx
 * 单栏、黑白、章节下划线、大量留白
 * 面向理工科 / 技术类岗位
 */
export function MinimalTemplate({ resume }: { resume: ResumeData }) {
  const { basics } = resume
  const summary = getSummary(resume)
  const experiences = getItems(resume, "experience")
  const projects = getItems(resume, "projects")
  const education = getItems(resume, "education")
  const skillGroups = getSkillGroups(resume)
  const awards = getAwards(resume)

  const contacts = [
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

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
      {/* ===== Header ===== */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Text style={s.name}>{basics.name}</Text>
          <Text style={s.title}>{basics.title}</Text>
          <View style={s.contactRow}>
            {contacts.map((c, i) => (
              <Text key={i} style={s.contactItem}>
                {c.label}：{c.value}
              </Text>
            ))}
          </View>
        </View>
        {basics.photo ? (
          <Image src={basics.photo} style={s.photo} />
        ) : null}
      </View>
      <View style={s.headerLine} />

      {/* ===== 个人简介 ===== */}
      {summary ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>个人简介</Text>
          <Text style={s.summaryText}>{summary}</Text>
        </View>
      ) : null}

      {/* ===== 工作经历 ===== */}
      {experiences.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>工作经历</Text>
          {experiences.map((exp, i) => (
            <View key={i} style={s.expItem} wrap={false}>
              <View style={s.expTitleRow}>
                <Text style={s.expTitle}>
                  {exp.subtitle ?? exp.title}
                  {exp.title && exp.subtitle ? <Text style={s.expRole}>  ·  {exp.title}</Text> : null}
                </Text>
                {exp.date ? <Text style={s.expDate}>{exp.date}</Text> : null}
              </View>
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

      {/* ===== 项目经历 ===== */}
      {projects.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>项目经历</Text>
          {projects.map((proj, i) => (
            <View key={i} style={s.expItem} wrap={false}>
              <View style={s.expTitleRow}>
                <Text style={s.expTitle}>
                  {proj.title}
                  {proj.subtitle ? <Text style={s.expRole}>  ·  {proj.subtitle}</Text> : null}
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

      {/* ===== 教育背景 ===== */}
      {educationItems.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>教育背景</Text>
          {educationItems.map((edu, i) => (
            <View key={i} style={s.eduItem} wrap={false}>
              <View style={s.eduLeft}>
                {edu.title ? <Text style={s.eduSchool}>{edu.title}</Text> : null}
                {edu.degree || edu.gpa ? (
                  <Text style={s.eduDegree}>
                    {[edu.degree, edu.gpa].filter(Boolean).join("  ·  ")}
                  </Text>
                ) : null}
                {edu.description &&
                edu.description.trim() !== edu.title?.trim() &&
                edu.description.trim() !== edu.degree?.trim() ? (
                  <Text style={s.eduDegree}>{edu.description}</Text>
                ) : null}
              </View>
              {edu.date ? <Text style={s.eduDate}>{edu.date}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* ===== 专业技能 ===== */}
      {skillGroups.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>专业技能</Text>
          {skillGroups.map((grp, i) => {
            const pills = grp.items.filter((item) => item.trim())
            if (pills.length === 0) return null
            return (
              <View key={i} style={s.skillRow}>
                {grp.group ? (
                  <Text style={s.skillGroup}>{grp.group}</Text>
                ) : null}
                <Text style={s.skillItems}>{pills.join("  ·  ")}</Text>
              </View>
            )
          })}
        </View>
      ) : null}

      {/* ===== 荣誉奖项 ===== */}
      {awards.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>荣誉奖项</Text>
          {awards.map((award, i) => (
            <View key={i} style={s.awardItem}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.bulletText}>{award}</Text>
            </View>
          ))}
        </View>
      ) : null}
      </Page>
    </Document>
  )
}
