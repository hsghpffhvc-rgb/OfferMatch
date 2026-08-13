import type { ComponentType } from "react"
import type { ResumeData } from "@/lib/pdf/types"
import { MinimalTemplate } from "./minimal/MinimalTemplate"
import { BusinessTemplate } from "./business/BusinessTemplate"
import { CreativeTemplate } from "./creative/CreativeTemplate"
import { TEMPLATE_OPTIONS, hasTemplate, type TemplateId } from "./options"

export type TemplateComponent = ComponentType<{ resume: ResumeData }>

export { TEMPLATE_OPTIONS, hasTemplate, type TemplateId }

const templateRegistry: Record<string, TemplateComponent> = {
  minimal: MinimalTemplate,
  business: BusinessTemplate,
  creative: CreativeTemplate,
}

/** 传 "minimal" / "business" / "creative" */
export function getTemplate(name: string): TemplateComponent {
  const tpl = templateRegistry[name]
  if (!tpl) throw new Error(`Unknown template: ${name}`)
  return tpl
}

export {
  MinimalTemplate,
  BusinessTemplate,
  CreativeTemplate,
}
