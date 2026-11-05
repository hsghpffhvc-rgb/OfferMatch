import { Document, Page, View, Text, Image } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { minimalStyles as s } from "./styles"
import {
  getSectionGroups,
  getSummary,
  getAwards,
  getSkillGroups,
  getHighlights,
  groupExperienceItems,
} from "../section-helpers"

/**
 * 极简风格模板 —— 翻译自 V0 的 minimal-resume.tsx
 * 单栏、黑白、章节下划线、大量留白
 * 面向理工科 / 技术类岗位
 */
export function MinimalTemplate({ resume }: { resume: ResumeData }) {
  const { basics } = resume
  const summary = getSummary(resume)
  const experienceGroups = getSectionGroups(resume, "experience")
  const projectGroups = getSectionGroups(resume, "projects")
  const education = getSectionGroups(resume, "education").flatMap((group) => group.items)
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

  const educationItems = education

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
          <Text style={s.sectionTitle} minPresenceAhead={56}>个人简介</Text>
          <Text style={s.summaryText}>{summary}</Text>
        </View>
      ) : null}

      {/* ===== 工作经历 / 实习经历 ===== */}
      {experienceGroups.map((section, sectionIndex) => (
        <View key={sectionIndex} style={s.section}>
          <Text style={s.sectionTitle} minPresenceAhead={56}>{section.title}</Text>
          {groupExperienceItems(section.items).map((group, i) => (
            <View key={i} style={s.expItem}>
              <View style={s.expTitleRow} minPresenceAhead={28}>
                <Text style={s.expTitle}>
                  {group.company ?? group.roles[0]?.projectName ?? group.roles[0]?.title ?? ""}
                  {group.company && group.roles.length === 1 && !group.roles[0]?.projectName && group.roles[0]?.title
                    ? <Text style={s.contextSecondary}>{`  ·  ${group.roles[0].title}`}</Text> : null}
                  {!group.company && group.roles[0]?.projectName && group.roles[0]?.title && group.roles[0].title !== group.roles[0].projectName ? <Text style={s.contextSecondary}>{`  ·  ${group.roles[0].title}`}</Text> : null}
                </Text>
                {group.date ? <Text style={s.expDate}>{group.date}</Text> : null}
              </View>
              {group.company && group.location ? (
                <Text style={s.expRole}>{group.location}</Text>
              ) : null}
              {group.roles.map((role, j) => (
                <View key={j}>
{group.company && (role.projectName || (group.roles.length > 1 && role.title)) ? (
                    <View style={s.roleTitleRow} minPresenceAhead={20}>
                      <Text style={s.contextTitle}>
                        {role.projectName || role.title}
                        {role.projectName && role.title && role.projectName !== role.title ? <Text style={s.contextSecondary}>{`  ·  ${role.title}`}</Text> : null}
                      </Text>
                      {role.date && role.date !== group.date ? <Text style={s.roleDate}>{role.date}</Text> : null}
                    </View>
                  ) : null}
                  {role.description ? <Text style={s.contextDescription}>{role.description}</Text> : null}
                  {role.highlights.map((point, k) => (
                    <Text key={k} style={[s.paragraphText, { marginTop: 2 }]} orphans={2} widows={2}>
                      {point.title ? <Text style={s.bulletTitle}>{point.title}：</Text> : null}
                        {point.text}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      {/* ===== 项目经历 ===== */}
      {projectGroups.map((section, sectionIndex) => (
        <View key={sectionIndex} style={s.section}>
          <Text style={s.sectionTitle} minPresenceAhead={56}>{section.title}</Text>
          {section.items.map((proj, i) => (
            <View key={i} style={s.expItem}>
              <View style={s.expTitleRow} minPresenceAhead={28}>
                <Text style={s.expTitle}>
                  {proj.title}
                  {proj.subtitle ? <Text style={s.contextSecondary}>  ·  {proj.subtitle}</Text> : null}
                </Text>
                {proj.date ? <Text style={s.expDate}>{proj.date}</Text> : null}
              </View>
              {getHighlights(proj).map((point, j) => (
                <Text key={j} style={[s.paragraphText, { marginTop: 2 }]} orphans={2} widows={2}>
                      {point.title ? <Text style={s.bulletTitle}>{point.title}：</Text> : null}
                    {point.text}
                    </Text>
              ))}
              {proj.description ? (
                <Text style={s.paragraphText}>{proj.description}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}

      {/* ===== 教育背景 ===== */}
      {educationItems.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle} minPresenceAhead={56}>教育背景</Text>
          {educationItems.map((edu, i) => (
            <View key={i} style={s.eduItem}>
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

      {/* ===== 专业技能：维度名与技能项同一行流动，避免维度名单独占行 ===== */}
      {skillGroups.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle} minPresenceAhead={56}>专业技能</Text>
          {skillGroups.map((grp, i) => {
            const pills = grp.items.filter((item) => item.trim())
            if (pills.length === 0) return null
            return (
              <View key={i} style={s.skillRow}>
                <Text style={s.skillItems}>
                  {grp.group ? <Text style={s.skillGroup}>{grp.group}：</Text> : null}
                  {pills.join("  ·  ")}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}

      {/* ===== 荣誉奖项 ===== */}
      {awards.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle} minPresenceAhead={56}>荣誉奖项</Text>
          {awards.map((award, i) => (
            <View key={i} style={s.awardItem}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.bulletText}>{award}</Text>
            </View>
          ))}
        </View>
      ) : null}

        {["languages", "certifications", "other"].flatMap((type) => getSectionGroups(resume, type as "languages" | "certifications" | "other")).map((group, index) => (
          <View key={`extra-${index}`} style={s.section}>
            <Text style={s.sectionTitle} minPresenceAhead={56}>{group.title}</Text>
            {group.items.map((item, itemIndex) => (
              <View key={itemIndex}>
                <Text style={s.paragraphText}>{[item.title, item.subtitle, item.date, item.location].filter(Boolean).join(" · ")}</Text>
                {item.description ? <Text style={s.paragraphText}>{item.description}</Text> : null}
                {getHighlights(item).map((point, pointIndex) => <Text key={pointIndex} style={s.paragraphText}>{point.title ? `${point.title}：` : ""}{point.text}</Text>)}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
