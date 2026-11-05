import { Document, Page, View, Text, Image } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { businessStyles as s } from "./styles"
import {
  getSectionGroups,
  getSummary,
  getAwards,
  getSkillGroups,
  getHighlights,
  groupExperienceItems,
} from "../section-helpers"

/**
 * 商务风格模板 —— 翻译自 V0 的 business-resume.tsx
 * 莫兰迪低饱和色系、头部横幅、灰底简介块、技能 pills、底部双栏
 * 面向投行 / 金融 / 行政类岗位
 */
export function BusinessTemplate({ resume }: { resume: ResumeData }) {
  const { basics } = resume
  const summary = getSummary(resume)
  const experienceGroups = getSectionGroups(resume, "experience")
  const projectGroups = getSectionGroups(resume, "projects")
  const education = getSectionGroups(resume, "education").flatMap((group) => group.items)
  const skillGroups = getSkillGroups(resume)
  const awards = getAwards(resume)

  const contactLines = [
    basics.phone,
    basics.email,
    [basics.location, basics.website].filter(Boolean).join("  ·  "),
  ].filter((v) => v && v.trim())

  const educationItems = education

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
            <View style={s.moduleTitleRow} minPresenceAhead={56}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>个人简介</Text>
            </View>
            <View style={s.summaryBlock}>
              <Text style={s.summaryText}>{summary}</Text>
            </View>
          </View>
        ) : null}

        {/* ===== 工作经历 / 实习经历 ===== */}
        {experienceGroups.map((section, sectionIndex) => (
          <View key={sectionIndex} style={s.section}>
            <View style={s.moduleTitleRow} minPresenceAhead={56}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>{section.title}</Text>
            </View>
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
                      {point.title ? <Text style={s.dotTitle}>{point.title}：</Text> : null}
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
            <View style={s.moduleTitleRow} minPresenceAhead={56}>
              <View style={s.moduleTitleBar} />
              <Text style={s.moduleTitle}>{section.title}</Text>
            </View>
            {section.items.map((proj, i) => (
              <View key={i} style={s.expItem}>
                <View style={s.expTitleRow} minPresenceAhead={28}>
                  <Text style={s.expTitle}>
                    {proj.title}
                    {proj.subtitle ? <Text style={s.contextSecondary}>{`  ·  ${proj.subtitle}`}</Text> : null}
                  </Text>
                  {proj.date ? <Text style={s.expDate}>{proj.date}</Text> : null}
                </View>
                {getHighlights(proj).map((point, j) => (
                  <Text key={j} style={[s.paragraphText, { marginTop: 2 }]} orphans={2} widows={2}>
                      {point.title ? <Text style={s.dotTitle}>{point.title}：</Text> : null}
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

        {/* ===== 教育 + 技能 双栏（两侧皆空则整块不渲染，避免塌陷留白） ===== */}
        {educationItems.length > 0 || skillGroups.length > 0 ? (
          <View style={s.twoCol}>
            {educationItems.length > 0 ? (
              <View style={s.colLeft}>
                <View style={s.moduleTitleRow} minPresenceAhead={56}>
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
                <View style={s.moduleTitleRow} minPresenceAhead={56}>
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
            <View style={s.moduleTitleRow} minPresenceAhead={56}>
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

        {["languages", "certifications", "other"].flatMap((type) => getSectionGroups(resume, type as "languages" | "certifications" | "other")).map((group, index) => (
          <View key={`extra-${index}`} style={s.section}>
            <View style={s.moduleTitleRow} minPresenceAhead={56}><View style={s.moduleTitleBar} /><Text style={s.moduleTitle}>{group.title}</Text></View>
            {group.items.map((item, itemIndex) => (
              <View key={itemIndex}>
                <Text style={s.paragraphText}>{[item.title, item.subtitle, item.date, item.location].filter(Boolean).join(" · ")}</Text>
                {item.description ? <Text style={s.paragraphText}>{item.description}</Text> : null}
                {getHighlights(item).map((point, pointIndex) => <Text key={pointIndex} style={s.paragraphText}>{point.title ? `${point.title}：` : ""}{point.text}</Text>)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </Page>
    </Document>
  )
}
