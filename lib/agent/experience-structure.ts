import type { StructuredResumeItem } from "./types"

/** 仅处理明确的经历概括，不能把真正的跨部门岗位名称一概移除。 */
export function normalizeExperienceItem(item: StructuredResumeItem): StructuredResumeItem {
  const role = (item.role ?? "").trim()
  if (!/^(?:多部门|跨部门)(?:任职|工作)(?:与|及|和)?(?:历练|经历|经验)?$/.test(role)) return item
  const summary = (item.summary ?? "").trim()
  return {
    ...item,
    role: "",
    summary: summary && /跨部门|多部门|不同职能部门/.test(summary)
      ? summary
      : [role, summary].filter(Boolean).join("。"),
  }
}
