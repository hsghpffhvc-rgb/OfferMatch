import { Document, Page, View, Text, Image } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { businessStyles as s } from "./styles"
import {
  getItems,
  getSummary,
  getAwards,
  getSkillGroups,
  getHighlights,
} from "../section-helpers"

/**
 * 商务风格模板 —— 翻译自 V0 的 business-resume.tsx
 * 莫兰迪低饱和色系、头部横幅、灰底简介块、技能 pills、底部双栏
 * 面向投行 / 金融 / 行政类岗位
 */
export function BusinessTemplate({ resume }: { resume: ResumeData }) {
  const { basics } = resume
  const summary = getSummary(resume)
  const experiences = getItems(resume, "experience")
  const projects = getItems(resume, "projects")
  const education = getItems(resume, "education")
  const skillGroups = getSkillGroups(resume)
  const awards = getAwards(resume)

  const contactLines = [
    basics.phone,
    basics.email,
    [basics.location, basics.website].filter(Boolean).join("  ·  "),
  ].filter((v) => v && v.trim())

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
      {/* ===== Header band ===== */}
      <View style={s.headerBand}>
        <View style={s.headerLeft}>
          {basics.photo ? (
            <Image src={basics.photo} style={s.photo} />
          ) : null}
          <View>
            <Text style={s.name}>{basics.name}</Text>
            <Text style={s.title}>{basics.title}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          {contactLines.map((line, i) => (
            <Text key={i} style={s.headerContact}>{line}</Text>
          ))}
        </View>
      </View>

      <View style={s.body}>
        {/* ===== 个人简介 ===== */}
        {summary ? (
          <View style={s.section}>
            <View style={s.moduleTitleRow}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>个人简介</Text>
            </View>
            <View style={s.summaryBlock}>
              <Text style={s.summaryText}>{summary}</Text>
            </View>
          </View>
        ) : null}

        {/* ===== 工作经历 ===== */}
        {experiences.length > 0 ? (
          <View style={s.section}>
            <View style={s.moduleTitleRow}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>工作经历</Text>
            </View>
            {experiences.map((exp, i) => (
              <View key={i} style={s.expItem} wrap={false}>
                <View style={s.expTitleRow}>
                  <Text style={s.expTitle}>{exp.subtitle ?? exp.title}</Text>
                  {exp.date ? <Text style={s.expDate}>{exp.date}</Text> : null}
                </View>
                {exp.title && exp.subtitle ? (
                  <Text style={s.expRole}>
                    {exp.title}
                    {exp.location ? `  ·  ${exp.location}` : ""}
                  </Text>
                ) : null}
                {getHighlights(exp).map((point, j) => (
                  <View key={j} style={s.dotItem}>
                    <View style={s.dot} />
                    <Text style={s.dotText}>
                      {point.title ? <Text style={s.dotTitle}>{point.title} </Text> : null}
                      {point.text}
                    </Text>
                  </View>
                ))}
                {exp.description && getHighlights(exp).length === 0 ? (
                  <Text style={s.dotText}>{exp.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ===== 项目经历 ===== */}
        {projects.length > 0 ? (
          <View style={s.section}>
            <View style={s.moduleTitleRow}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>项目经历</Text>
            </View>
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
                  <View key={j} style={s.dotItem}>
                    <View style={s.dot} />
                    <Text style={s.dotText}>
                      {point.title ? <Text style={s.dotTitle}>{point.title} </Text> : null}
                      {point.text}
                    </Text>
                  </View>
                ))}
                {proj.description && getHighlights(proj).length === 0 ? (
                  <Text style={s.dotText}>{proj.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ===== 教育 + 技能 双栏（两侧皆空则整块不渲染，避免塌陷留白） ===== */}
        {educationItems.length > 0 || skillGroups.length > 0 ? (
          <View style={s.twoCol}>
            {educationItems.length > 0 ? (
              <View style={s.colLeft}>
                <View style={s.moduleTitleRow}>
                  <View style={s.moduleTitleBar} />
                  <Text style={s.moduleTitle}>教育背景</Text>
                </View>
                {educationItems.map((edu, i) => (
                  <View key={i} style={s.eduItem}>
                    {edu.title ? (
                      <Text style={s.eduSchool}>{edu.title}</Text>
                    ) : null}
                    {edu.date ? (
                      <Text style={s.eduPeriod}>{edu.date}</Text>
                    ) : null}
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
                ))}
              </View>
            ) : null}

            {skillGroups.length > 0 ? (
              <View style={educationItems.length > 0 ? s.colRight : s.colLeft}>
                <View style={s.moduleTitleRow}>
                  <View style={s.moduleTitleBar} />
                  <Text style={s.moduleTitle}>专业技能</Text>
                </View>
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
                          <Text key={j} style={s.pill}>
                            {item}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ===== 荣誉奖项 ===== */}
        {awards.length > 0 ? (
          <View style={s.section}>
            <View style={s.moduleTitleRow}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>荣誉奖项</Text>
            </View>
            <View style={s.awardRow}>
              {awards.map((award, i) => (
                <View key={i} style={s.awardItem}>
                  <View style={s.awardDot} />
                  <Text style={s.awardText}>{award}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Page>
    </Document>
  )
}
