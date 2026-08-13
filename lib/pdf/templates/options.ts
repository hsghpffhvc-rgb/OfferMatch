export const TEMPLATE_OPTIONS = [
  {
    id: "minimal",
    label: "极简风格",
    description: "单栏黑白，留白充足，适合技术岗",
    previewSrc: "/templates/minimal.png",
  },
  {
    id: "business",
    label: "商务风格",
    description: "莫兰迪色系与双栏信息，适合商务岗",
    previewSrc: "/templates/business.png",
  },
  {
    id: "creative",
    label: "设计感",
    description: "深色侧栏双栏布局，适合设计创意岗",
    previewSrc: "/templates/creative.png",
  },
] as const

export type TemplateId = (typeof TEMPLATE_OPTIONS)[number]["id"]

export function hasTemplate(name: string): boolean {
  return TEMPLATE_OPTIONS.some((opt) => opt.id === name)
}

export function getTemplateOption(id: string) {
  return TEMPLATE_OPTIONS.find((opt) => opt.id === id) ?? TEMPLATE_OPTIONS[0]
}
