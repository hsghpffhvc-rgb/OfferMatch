import { Document, Page, View, Text, Image, Svg, Path } from "@react-pdf/renderer"
import type { ResumeData } from "@/lib/pdf/types"
import { creativeStyles as s } from "./styles"
import {
  getSectionGroups,
  getSummary,
  getAwards,
  getSkillGroups,
  getHighlights,
  groupExperienceItems,
  getSectionIconLabel,
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
  "实习经历": "实",
  "项目经历": "项",
  "荣誉奖项": "誉",
}

export function CreativeTemplate({ resume }: { resume: ResumeData }) {
  const { basics } = resume
  const summary = getSummary(resume)
  const experienceGroups = getSectionGroups(resume, "experience")
  const projectGroups = getSectionGroups(resume, "projects")
  const education = getSectionGroups(resume, "education").flatMap((group) => group.items)
  const skillGroups = getSkillGroups(resume)
  const awards = getAwards(resume)

  const contactItems = [
    { label: "电话", value: basics.phone },
    { label: "邮箱", value: basics.email },
    { label: "地址", value: basics.location },
    { label: "网站", value: basics.website },
    { label: "GitHub", value: basics.github },
    { label: "LinkedIn", value: basics.linkedin },
  ].filter((c) => c.value && c.value.trim())

  const educationItems = education

  const MainTitle = ({ children }: { children: string }) => (
    <View style={s.mainTitleRow} minPresenceAhead={56}>
      <View style={s.mainTitleIcon}>
        {/校园|校内|学生|教育|学历/.test(children) ? (
          <Svg width={13} height={13} viewBox="0 0 24 24">
            <Path d="M2 9L12 3L22 9L12 15Z M6 12V18L12 21L18 18V12 M22 9V17" stroke="#FFFFFF" strokeWidth={1.6} fill="none" />
          </Svg>
        ) : (
          <Text style={s.mainTitleIconText}>{ICON_MAP[children] ?? getSectionIconLabel(children)}</Text>
        )}
      </View>
      <Text style={s.mainTitle}>{children}</Text>
    </View>
  )

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
      {/* ===== Left Sidebar ===== */}
      {/* 深色色块 fixed：多页时保持左侧版式一致 */}
      <View fixed style={s.sidebarBanner} />
      {/* 个人信息只在第一页出现，避免第二页把姓名 / 教育 / 技能再写一遍 */}
      {/* 侧栏内容固定：不参与分页，避免侧栏撑高导致第一页正文被挤到下一页 */}
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

        {/* Experience / Internship：同一单位的多个岗位只展示一次 */}
        {experienceGroups.map((section, sectionIndex) => (
          <View key={sectionIndex} style={s.mainSection}>
            <MainTitle>{section.title}</MainTitle>
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
                  <Text style={s.expSub}>{group.location}</Text>
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

        {/* Projects */}
        {projectGroups.map((section, sectionIndex) => (
          <View key={sectionIndex} style={s.mainSection}>
            <MainTitle>{section.title}</MainTitle>
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

        {["languages", "certifications", "other"].flatMap((type) => getSectionGroups(resume, type as "languages" | "certifications" | "other")).map((group, index) => (
          <View key={`extra-${index}`} style={s.mainSection}>
            <MainTitle>{group.title}</MainTitle>
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
