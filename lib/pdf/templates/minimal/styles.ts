import { StyleSheet } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

// 极简风格 —— 纯黑白、章节下划线、大量留白
export const minimalStyles = StyleSheet.create({
  page: {
    fontFamily: RESUME_FONT_FAMILY,
    fontSize: 9,
    color: "#374151",
    paddingTop: 34,
    paddingBottom: 30,
    paddingLeft: 42,
    paddingRight: 42,
  },

  // ---- Header ----
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111827",
    lineHeight: 1.2,
  },
  title: {
    fontSize: 11.5,
    color: "#6B7280",
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 7,
  },
  contactItem: {
    fontSize: 9,
    color: "#6B7280",
    marginRight: 9,
    marginBottom: 2,
  },
  photo: {
    width: 80,
    height: 104,
    objectFit: "cover",
  },
  headerLine: {
    width: "100%",
    height: 1,
    backgroundColor: "#111827",
    marginTop: 11,
    marginBottom: 13,
  },

  // ---- Section ----
  section: {
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 3,
    marginBottom: 6,
  },

  // ---- Summary ----
  summaryText: {
    fontSize: 9.2,
    lineHeight: 1.4,
    color: "#4B5563",
    textAlign: "justify",
  },

  // ---- Experience / Projects ----
  expItem: {
    marginBottom: 8,
  },
  expTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  expTitle: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
    paddingRight: 8,
  },
  expRole: {
    fontSize: 9.5,
    fontWeight: "normal",
    color: "#6B7280",
  },
  expDate: {
    fontSize: 8.7,
    color: "#9CA3AF",
    flexShrink: 0,
  },
  // 同一单位的第二个及以后的岗位：同一单位块内的岗位行
  roleTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 3,
    marginBottom: 1,
  },
  roleTitle: {
    fontSize: 9.8,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
    paddingRight: 8,
  },
  roleDate: {
    fontSize: 8.5,
    color: "#9CA3AF",
    flexShrink: 0,
  },
  // 粗体标签/结构性总结必须与描述同一行
  bulletItem: {
    flexDirection: "row",
    marginTop: 2,
  },
  bullet: {
    fontSize: 8.8,
    color: "#9CA3AF",
    marginRight: 6,
  },
  bulletText: {
    fontSize: 9.2,
    lineHeight: 1.4,
    color: "#4B5563",
    flex: 1,
    textAlign: "justify",
  },
  bulletTitle: {
    fontWeight: "bold",
    color: "#111827",
  },

  contextTitle: { fontSize: 10.5, fontWeight: "bold", color: "#111827", flex: 1, paddingRight: 8 },
  contextSecondary: { fontSize: 9.5, fontWeight: "normal", color: "#6B7280" },
  // 独立段落必须按内容撑开高度，不复用行内 flex 文本样式。
  paragraphText: { fontSize: 9.2, lineHeight: 1.4, color: "#4B5563", textAlign: "justify", flexShrink: 0 },
  contextDescription: { textAlign: "justify", fontSize: 9.2, lineHeight: 1.4, color: "#4B5563", marginTop: 2, marginBottom: 2 },

  // ---- Education ----
  eduItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 5,
  },
  eduLeft: {
    flex: 1,
  },
  eduSchool: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#111827",
  },
  eduDegree: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 2,
  },
  eduDate: {
    fontSize: 8.7,
    color: "#9CA3AF",
  },

  // ---- Skills ----
  skillRow: {
    marginBottom: 3,
  },
  skillGroup: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
  },
  skillItems: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#4B5563",
    textAlign: "justify",
  },

  // ---- Awards ----
  awardItem: {
    flexDirection: "row",
    marginTop: 2,
  },
})
