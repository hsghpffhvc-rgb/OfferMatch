import test from 'node:test'
import assert from 'node:assert/strict'
import { register, createRequire } from 'node:module'
import { createElement } from 'react'
import path from 'node:path'

register('../scripts/ts-hook.mjs', import.meta.url)
const require = createRequire(import.meta.url)
const { Font, renderToBuffer } = require('@react-pdf/renderer')
const { mapRewriteResultToResumeData } = await import('../lib/pdf/mapper.ts')
const { getTemplate } = await import('../lib/pdf/templates/index.ts')
const { resumeHyphenationCallback } = await import('../lib/pdf/hyphenation.ts')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
Font.register({family:'ResumeSans', fonts:[{src:path.resolve('public/fonts/NotoSansSC-Regular.ttf'),fontWeight:'normal'}, {src:path.resolve('public/fonts/NotoSansSC-Bold.ttf'),fontWeight:'bold'}]})
Font.registerHyphenationCallback(resumeHyphenationCallback)
const data = mapRewriteResultToResumeData({resume:{ basics:{name:'张三',title:'产品经理'}, summary:{text:''}, skills:[], sections:[{type:'experience',title:'实习经历',items:[{company:'字节跳动',role:'产品运营实习生',projectName:'校园问答项目',highlights:[{title:'需求分析',action:'完成需求调研'}]}]}]}})

test('三套 PDF 保留公司岗位、项目名称及职责，并按顺序排版', async () => {
  assert.equal(data.sections[0].items[0].projectName, '校园问答项目')
  for (const template of ['minimal','business','creative']) {
    data.metadata.template=template
    const bytes = await renderToBuffer(createElement(getTemplate(template), {resume:data}))
    const doc = await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    const page = await doc.getPage(1)
    const content = await page.getTextContent()
    const items = content.items.filter(i => typeof i.str === 'string')
    const text = items.map(i=>i.str).join('')
    assert.match(text, /字节跳动/)
    assert.match(text, /产品运营实习生/)
    assert.ok(text.indexOf('校园问答项目') < text.indexOf('需求分析'), template)
    const company = items.find(i=>i.str.includes('字节跳动'))
    const role = items.find(i=>i.str.includes('产品运营实习生'))
    const project = items.find(i=>i.str.includes('校园问答项目'))
    assert.ok(company && role && project && Math.abs(project.transform[5]-role.transform[5]) < 1, template)
    assert.ok(company.transform[5] > project.transform[5], template)
    assert.ok(project.height > role.height, `${template}: 项目名称应比角色醒目`)
    if (template === 'creative') assert.ok(items.some(i=>i.str==='实'), '实习图标')
    await doc.cleanup()
  }
})

test('多部门总述与同一单位的多个项目分别保留，不虚构部门岗位', async () => {
  const original = '先后在图书馆资源推广中心、基建处以及人工智能中心三个不同职能部门任职与历练。深度参与部门日常事务，积极承担上级需求并推动业务落地。'
  const resume = mapRewriteResultToResumeData({resume:{ basics:{name:'测试',title:'产品经理'}, summary:{text:''}, skills:[], sections:[{type:'experience',title:'工作经历',items:[
    {company:'某单位',role:'多部门任职与历练',summary:original,highlights:[]},
    {company:'某单位',role:'AI产品负责人',projectName:'企业知识库问答系统',highlights:[{title:'需求分析',action:'开展调研'}]},
    {company:'某单位',role:'产品经理',projectName:'业务平台',highlights:[{title:'流程设计',action:'设计流程'}]},
  ]}]}})
  assert.equal(resume.sections[0].items[0].title, '')
  for (const template of ['minimal','business','creative']) {
    resume.metadata.template=template
    const bytes = await renderToBuffer(createElement(getTemplate(template), {resume}))
    const doc=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    const textParts=[]
    for(let n=1;n<=doc.numPages;n++) textParts.push(...(await (await doc.getPage(n)).getTextContent()).items.map(i=>i.str ?? ''))
    const text=textParts.join('')
    for (const phrase of ['图书馆资源推广中心','基建处','人工智能中心','企业知识库问答系统','AI产品负责人','业务平台','产品经理','开展调研','设计流程']) assert.ok(text.includes(phrase), `${template}: ${phrase}`)
    assert.ok(text.indexOf('企业知识库问答系统') < text.indexOf('AI产品负责人'))
    assert.ok(text.indexOf('业务平台') < text.indexOf('产品经理', text.indexOf('业务平台')))
    await doc.cleanup()
  }
})

test('教育说明与学校或学位重复时仍保留教育条目', async () => {
  const resume=mapRewriteResultToResumeData({resume:{basics:{name:'测试',title:'产品经理'},summary:{text:''},skills:[],sections:[{type:'education',title:'教育背景',items:[{school:'湖北工业大学',degree:'本科',notes:'湖北工业大学'}]}]}})
  for (const template of ['minimal','business','creative']) {
    resume.metadata.template=template
    const bytes=await renderToBuffer(createElement(getTemplate(template),{resume}))
    const doc=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    const page=await doc.getPage(1)
    const text=(await page.getTextContent()).items.map(i=>i.str??'').join('')
    assert.ok(text.includes('湖北工业大学'),template)
    assert.ok(text.includes('本科'),template)
    await doc.cleanup()
  }
})

test('校园经历的折行恢复为连续正文，三套模板保留单个模块', async () => {
  const { renderResumeMarkdown } = await import('../lib/agent/rewrite-quality.ts')
  const source = '党委学工部学生发展中心主席团，统筹13个部门、300+学工助\n\n理；赴蔡甸开展湖北省“三下乡”社会实践活动，获评湖北省优秀团队；2023.6 -\n\n2024.3留任校党委学工部，协助综合办完成工作。'
  const structured = {basics:{name:'测试',title:''},summary:{text:''},skills:[],sections:[{type:'experience',title:'校园经历',items:[{summary:source,highlights:[]}]}]}
  const resume = mapRewriteResultToResumeData({resume:structured})
  assert.equal(resume.sections.length, 1)
  const prose = resume.sections[0].items[0].description
  assert.match(prose, /学工助理；/)
  assert.match(prose, /2023\.6 - 2024\.3/)
  assert.ok(!prose.includes('\n'))
  assert.ok(renderResumeMarkdown(structured).includes(prose))
  for (const template of ['minimal','business','creative']) {
    resume.metadata.template=template
    const bytes=await renderToBuffer(createElement(getTemplate(template),{resume}))
    const doc=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    const items=(await (await doc.getPage(1)).getTextContent()).items.filter(i=>typeof i.str==='string')
    const text=items.map(i=>i.str).join('')
    assert.equal((text.match(/校园经历/g) ?? []).length, 1, template)
    assert.ok(text.includes('学工助理'), template)
    assert.ok(text.includes('2024.3'), template)
    await doc.cleanup()
  }
})

test('折行恢复保留明确的句末和条目边界', async () => {
  const { joinResumeProse } = await import('../lib/agent/resume-text.ts')
  assert.equal(joinResumeProse('第一句。\n第二句。\n- 独立条目'), '第一句。\n第二句。\n- 独立条目')
  assert.equal(joinResumeProse('项目使用 React\nNative 完成开发'), '项目使用 React Native 完成开发')
})

test('同名校园经历模块合并时不丢失条目', () => {
  const resume=mapRewriteResultToResumeData({resume:{basics:{name:'测试'},summary:{text:''},skills:[],sections:[
    {type:'experience',title:'校园经历',items:[{summary:'第一条校园经历。'}]},
    {type:'experience',title:'校园经历',items:[{summary:'第二条校园经历。'}]},
  ]}})
  assert.equal(resume.sections.length,1)
  assert.deepEqual(resume.sections[0].items.map(item=>item.description),['第一条校园经历。','第二条校园经历。'])
})

test('语言、证书、自定义模块和项目说明在所有模板中保留', async () => {
  const resume=mapRewriteResultToResumeData({resume:{basics:{name:'测试'},summary:{text:''},skills:[],sections:[
    {type:'languages',title:'语言能力',items:[{name:'英语',level:'熟练'}]},
    {type:'certifications',title:'证书',items:[{name:'项目管理证书'}]},
    {type:'other',title:'志愿经历',items:[{name:'公益活动',summary:'协助社区服务。'}]},
    {type:'projects',title:'项目经历',items:[{name:'示例项目',summary:'项目背景说明。',highlights:[{action:'开展用户调研'}]}]},
  ]}})
  for (const template of ['minimal','business','creative']) {
    resume.metadata.template=template
    const bytes=await renderToBuffer(createElement(getTemplate(template),{resume}))
    const doc=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    let text=''
    for(let n=1;n<=doc.numPages;n++) text+=(await (await doc.getPage(n)).getTextContent()).items.map(i=>i.str??'').join('')
    for(const phrase of ['英语','熟练','项目管理证书','志愿经历','公益活动','协助社区服务','项目背景说明','开展用户调研']) assert.ok(text.includes(phrase),`${template}: ${phrase}`)
    await doc.cleanup()
  }
})
