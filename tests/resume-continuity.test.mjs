import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
register('../scripts/ts-hook.mjs', import.meta.url)
const {recoverResumeBasics, retainMissingResumeContent} = await import('../lib/agent/resume-continuity.ts')
const {getMissingSourceSections, mergeRepairedSections, restoreSourceEducation} = await import('../lib/agent/section-coverage.ts')
const {auditAndFinalizeRewrite} = await import('../lib/agent/rewrite-quality.ts')

const basics = (overrides={}) => ({name:'',title:'',phone:'',email:'',location:'',linkedin:'',github:'',website:'',photo:'',...overrides})
const resume = (overrides={}) => ({basics:basics(),summary:{text:'',positioning:'',yearsExperience:0,keywords:[]},sections:[],skills:[],...overrides})
const original = '张三\n电话：13800138000\n邮箱：person@example.com\n教育背景\n某大学 本科\n工作经历\n某公司 产品经理'
const snapshot = {basics:{name:'张三',title:'',contact:'13800138000 person@example.com'},sections:[],summary:'',coverage:{sourceChars:0,coveredItems:0,extras:[]}}

test('首次生成缺个人信息时，使用原文可核对的快照姓名与唯一联系方式', () => {
  const value = recoverResumeBasics(basics(), original, snapshot)
  assert.equal(value.name, '张三')
  assert.equal(value.phone, '13800138000')
  assert.equal(value.email, 'person@example.com')
  assert.equal(recoverResumeBasics(basics(), original, {...snapshot, basics:{...snapshot.basics,name:'李四'}}).name, '')
  assert.equal(recoverResumeBasics(basics(), original+'\n13900139000', snapshot).phone, '')
  assert.equal(recoverResumeBasics(basics(), '姓名：张三\n教育背景\n某大学').name, '张三')
  assert.equal(recoverResumeBasics(basics(), '邮箱：13800138000@example.com').phone, '')
})

test('重试新增教育但漏个人信息与原有章节时保留同一份简历的已有内容', () => {
  const previous=resume({basics:basics({name:'张三',phone:'13800138000',email:'person@example.com',title:'产品经理'}),summary:{text:'已有总结'},sections:[{type:'experience',title:'工作经历',items:[{role:'产品经理',company:'某公司'}]}],skills:[{group:'技能',items:[{name:'需求分析'}]}]})
  const generated=resume({sections:[{type:'education',title:'教育背景',items:[{school:'某大学',degree:'本科'}]}]})
  const retained=retainMissingResumeContent(generated,previous)
  retained.basics=recoverResumeBasics(retained.basics,original,snapshot,previous.basics)
  assert.deepEqual(retained.sections.map(x=>x.type),['education','experience'])
  assert.equal(retained.basics.name,'张三')
  assert.equal(retained.basics.email,'person@example.com')
  assert.equal(retained.summary.text,'已有总结')
  assert.equal(retained.skills[0].items[0].name,'需求分析')
  assert.equal(recoverResumeBasics(basics(), '另一份简历', undefined, previous.basics).name,'')
})

test('空教育章节会触发修复；合并教育时不覆盖个人信息或技能', () => {
  const current={resume:resume({basics:basics({name:'张三'}),sections:[{type:'education',title:'教育背景',items:[]}],skills:[{group:'原技能',items:[{name:'原技能'}]}]}),modifications:[],analysis:{}}
  const repaired={resume:resume({sections:[{type:'education',title:'教育背景',items:[{school:'某大学'}]}],skills:[{group:'其他',items:[{name:'其他'}]}]}),modifications:[],analysis:{}}
  assert.deepEqual(getMissingSourceSections(current,original).map(x=>x.type),['experience','education'])
  const merged=mergeRepairedSections(current,repaired,['education'])
  assert.equal(merged.resume.basics.name,'张三')
  assert.equal(merged.resume.skills[0].group,'原技能')
  assert.equal(merged.resume.sections[0].items[0].school,'某大学')
})

test('首次生成漏教育时保留原始教育事实，不包含后续工作章节', () => {
  const current={resume:resume({sections:[{type:'experience',title:'工作经历',items:[{company:'某公司'}]}]}),modifications:[],scores:{keywordAnalysis:{stillMissing:[]}},analysis:{requirements:[],gaps:[]}}
  const restored=restoreSourceEducation(current,original)
  const education=restored.resume.sections.find(section=>section.type==='education')
  assert.deepEqual(education.items.map(item=>item.notes),['某大学 本科'])
  assert.deepEqual(getMissingSourceSections(restored,original),[])
  const output=auditAndFinalizeRewrite(restored,{originalResume:original})
  assert.ok(output.markdown.includes('某大学 本科'))
  assert.ok(!output.issues.some(issue=>issue.code==='MISSING_SECTION' && issue.message.includes('教育')))
  const inline=restoreSourceEducation(current,'## 教育背景：某大学 本科\n工作经历\n某公司')
  assert.equal(inline.resume.sections.find(section=>section.type==='education').items[0].notes,'某大学 本科')
})

test('有原始简历但无法识别姓名时，结果不能标为可直接投递', () => {
  const current={resume:resume(),modifications:[],scores:{keywordAnalysis:{stillMissing:[]}},analysis:{requirements:[],gaps:[]}}
  const output=auditAndFinalizeRewrite(current,{originalResume:'未能识别姓名的原始简历文本'})
  assert.equal(output.rewrite.verification.status,'draft')
  assert.ok(output.issues.some(issue=>issue.message.includes('未识别到姓名')))
})

test('正文存在 XXX 时标记草稿，不能显示可直接投递', () => {
  const current={resume:resume({basics:basics({name:'张三'}),sections:[{type:'experience',title:'工作经历',items:[{company:'某公司',role:'产品经理',summary:'负责 XXX 模块'}]}]}),modifications:[],scores:{keywordAnalysis:{stillMissing:[]}},analysis:{requirements:[],gaps:[]}}
  const output=auditAndFinalizeRewrite(current,{originalResume:original})
  assert.equal(output.rewrite.verification.status,'draft')
  assert.ok(output.issues.some(issue=>issue.message.includes('XXX')))
})
