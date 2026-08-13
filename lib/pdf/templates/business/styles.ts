import { StyleSheet } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

// 莫兰迪色板 —— 翻译自 V0 business-resume.tsx 的 C 对象
const C = {
  ink: "#3D3B39",      // 主文字 灰褐
  sub: "#6F6A63",      // 次文字
  line: "#D8D2C8",     // 分隔线 米灰
  band: "#E8E3D9",     // 模块底色 燕麦
  accent: "#7C8471",   // 点缀 鼠尾草绿
  soft: "#F4F1EA",     // 极浅底色
}

export const businessStyles = StyleSheet.create({
  page: {
    fontFamily: RESUME_FONT_FAMILY,
    fontSize: 9,
    color: C.ink,
    paddingTop: 0,
    paddingBottom: 30,
    paddingLeft: 0,
    paddingRight: 0,
  },

  // ---- Header band ----
  headerBand: {
    backgroundColor: C.band,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 42,
    paddingTop: 28,
    paddingBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  photo: {
    width: 76,
    height: 99,
    marginRight: 20,
    objectFit: "cover",
  },
  name: {
    fontSize: 25,
    fontWeight: "bold",
    color: C.ink,
    letterSpacing: 1.2,
    lineHeight: 1.2,
  },
  title: {
    fontSize: 11,
    color: C.accent,
    marginTop: 2,
    letterSpacing: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerContact: {
    fontSize: 9,
    color: C.sub,
    lineHeight: 1.4,
  },

  // ---- Body ----
  body: {
    paddingHorizontal: 42,
    paddingTop: 20,
  },

  // ---- Section ----
  section: {
    marginBottom: 13,
  },
  moduleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  moduleTitleBar: {
    width: 3,
    height: 12,
    backgroundColor: C.accent,
    marginRight: 8,
  },
  moduleTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: C.ink,
    letterSpacing: 1,
  },

  // ---- Summary block ----
  summaryBlock: {
    backgroundColor: C.soft,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryText: {
    fontSize: 9.2,
    lineHeight: 1.4,
    color: C.sub,
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
    color: C.ink,
    flex: 1,
    paddingRight: 8,
  },
  expDate: {
    fontSize: 8.7,
    color: C.sub,
    flexShrink: 0,
  },
  expRole: {
    fontSize: 9.2,
    color: C.accent,
    marginTop: 2,
    marginBottom: 2,
  },
  dotItem: {
    flexDirection: "row",
    marginTop: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.accent,
    marginTop: 5,
    marginRight: 5,
  },
  dotText: {
    fontSize: 9.2,
    lineHeight: 1.4,
    color: C.sub,
    flex: 1,
  },
  dotTitle: {
    fontWeight: "bold",
    color: C.ink,
  },

  // ---- Two-column (Education + Skills) ----
  twoCol: {
    flexDirection: "row",
  },
  colLeft: {
    flex: 1,
    paddingRight: 9,
  },
  colRight: {
    flex: 1,
    paddingLeft: 9,
  },

  // ---- Education ----
  eduItem: {
    marginBottom: 6,
  },
  eduSchool: {
    fontSize: 10.2,
    fontWeight: "bold",
    color: C.ink,
  },
  eduPeriod: {
    fontSize: 8.7,
    color: C.accent,
    marginTop: 2,
  },
  eduDegree: {
    fontSize: 9,
    color: C.sub,
    marginTop: 1,
  },

  // ---- Skills pills ----
  skillGroup: {
    marginBottom: 8,
  },
  skillGroupTitle: {
    fontSize: 9.2,
    fontWeight: "bold",
    color: C.ink,
    marginBottom: 3,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pill: {
    fontSize: 8.6,
    color: C.sub,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    marginRight: 5,
    marginBottom: 3,
    maxWidth: "100%",
  },

  // ---- Awards (inline) ----
  awardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  awardItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  awardDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.accent,
    marginRight: 5,
  },
  awardText: {
    fontSize: 9.2,
    color: C.sub,
  },
})
