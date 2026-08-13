import { StyleSheet } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

// 色板 —— 翻译自 V0 creative-resume.tsx
const INK = "#1F2B47"       // 主色 深靛蓝
const ACCENT = "#3F7FB3"     // 辅助色 雾蓝
const SIDEBAR_TEXT = "#A9C6DD"
const MAIN_TEXT = "#33404F"

export const creativeStyles = StyleSheet.create({
  page: {
    fontFamily: RESUME_FONT_FAMILY,
    fontSize: 9,
    // 主栏使用正常文档流；给绝对定位的侧栏预留空间，避免分页死循环。
    paddingLeft: 178,
  },

  // ===== Sidebar =====
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 178, // ~63mm
    backgroundColor: INK,
    paddingHorizontal: 18,
    paddingVertical: 24,
    color: "#FFFFFF",
  },
  sidebarCenter: {
    alignItems: "center",
    marginBottom: 14,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 14,
    objectFit: "cover",
  },
  sidebarName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    lineHeight: 1.2,
    textAlign: "center",
  },
  sidebarTitle: {
    fontSize: 9.5,
    color: SIDEBAR_TEXT,
    marginTop: 4,
    textAlign: "center",
  },

  // Sidebar sections
  sidebarSection: {
    marginBottom: 12,
  },
  sidebarTitle2: {
    fontSize: 9.2,
    fontWeight: "bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },

  // Contact items (icon replaced with text label)
  contactItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  contactLabel: {
    fontSize: 8,
    color: SIDEBAR_TEXT,
    width: 36,
    flexShrink: 0,
  },
  contactValue: {
    fontSize: 8.4,
    color: "#FFFFFF",
    opacity: 0.85,
    flex: 1,
  },

  // Education in sidebar
  eduItem: {
    marginBottom: 5,
  },
  eduSchool: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  eduDegree: {
    fontSize: 8.2,
    color: "#FFFFFF",
    opacity: 0.75,
    marginTop: 1,
  },
  eduPeriod: {
    fontSize: 8,
    color: SIDEBAR_TEXT,
    marginTop: 2,
  },
  eduDetail: {
    fontSize: 7.6,
    color: "#FFFFFF",
    opacity: 0.6,
    marginTop: 1,
  },

  // Skills pills in sidebar
  skillGroup: {
    marginBottom: 8,
  },
  skillGroupTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#FFFFFF",
    opacity: 0.9,
    marginBottom: 2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pill: {
    fontSize: 7.8,
    color: "#FFFFFF",
    opacity: 0.9,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 3,
    marginBottom: 3,
    maxWidth: "100%",
  },

  // Languages
  langRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  langName: {
    fontSize: 8.4,
    color: "#FFFFFF",
    opacity: 0.85,
  },
  langLevel: {
    fontSize: 8.4,
    color: SIDEBAR_TEXT,
  },

  // ===== Main content =====
  main: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    color: MAIN_TEXT,
  },

  mainSection: {
    marginBottom: 12,
  },

  // Section title with accent square (replaces V0's icon)
  mainTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  mainTitleIcon: {
    width: 18,
    height: 18,
    backgroundColor: ACCENT,
    borderRadius: 3,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  mainTitleIconText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  mainTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: INK,
  },

  // Summary
  summaryText: {
    fontSize: 9.2,
    lineHeight: 1.4,
    color: MAIN_TEXT,
  },

  // Experience / Projects (left border accent)
  expItem: {
    borderLeftWidth: 2,
    borderLeftColor: "#DBE3EC",
    paddingLeft: 9,
    marginBottom: 8,
  },
  expTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  expTitle: {
    fontSize: 10.2,
    fontWeight: "bold",
    color: INK,
    flex: 1,
    paddingRight: 8,
  },
  expDate: {
    fontSize: 8.5,
    color: ACCENT,
    flexShrink: 0,
  },
  expSub: {
    fontSize: 9,
    color: ACCENT,
    marginTop: 2,
    marginBottom: 2,
  },
  bulletItem: {
    flexDirection: "row",
    marginTop: 2,
  },
  bullet: {
    fontSize: 8.5,
    color: "#9FB4C8",
    marginRight: 5,
  },
  bulletText: {
    fontSize: 9.2,
    lineHeight: 1.4,
    color: MAIN_TEXT,
    flex: 1,
  },
  bulletTitle: {
    fontWeight: "bold",
    color: INK,
  },
})
