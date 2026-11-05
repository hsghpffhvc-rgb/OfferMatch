import test from 'node:test'
import assert from 'node:assert/strict'
import { register, createRequire } from 'node:module'
import { createElement } from 'react'
import path from 'node:path'
import fs from 'node:fs'
register('../scripts/ts-hook.mjs', import.meta.url)
const require = createRequire(import.meta.url)
const { Font, renderToBuffer } = require('@react-pdf/renderer')
const { createCanvas } = require('@napi-rs/canvas')
const { getTemplate } = await import('../lib/pdf/templates/index.ts')
const { resumeHyphenationCallback } = await import('../lib/pdf/hyphenation.ts')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
Font.register({family:'ResumeSans',fonts:[{src:path.resolve('public/fonts/NotoSansSC-Regular.ttf'),fontWeight:'normal'},{src:path.resolve('public/fonts/NotoSansSC-Bold.ttf'),fontWeight:'bold'}]})
Font.registerHyphenationCallback(resumeHyphenationCallback)

for (const template of ['minimal','business','creative']) {
  test(`${template}: 长项目说明和后续项目不重叠，跨页仍保留完整内容`, async () => {
    const resume={basics:{name:'排版验证',title:'产品设计与开发',email:'test@example.com',phone:''},metadata:{template},sections:[
      {id:'projects',type:'projects',title:'项目经历',items:Array.from({length:8},(_,i)=>({title:`NEXT${i} AI 游戏策划与交互设计`,subtitle:'项目负责人',date:'2025.06 - 2026.03',highlights:[{title:'交互Demo交付',text:'承担角色设定、关卡与互动机制设计，协调团队完成交付。'}],description:'面向应届求职学员设计单一目标岗位简历优化工作台，完成从需求调研到产品验证的闭环。'.repeat(3)+` END${i}`}))},
      {id:'extra',type:'other',title:'其他成果',items:[{title:'EXTRA',description:'附加模块中的长段落也必须按实际行数占据高度。'.repeat(6)+' EXTRAEND'},{title:'AFTEREXTRA',description:'内容完整保留。'}]},
    ]}
    const bytes=await renderToBuffer(createElement(getTemplate(template),{resume}))
    const doc=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    const items=[]
    const out=process.env.PDF_LAYOUT_ARTIFACTS
    if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${template}.pdf`),bytes)}
    for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
      const page=await doc.getPage(pageNumber)
      items.push(...(await page.getTextContent()).items.filter(i=>i.str?.trim()).map(i=>({...i,page:pageNumber})))
      if(out){const viewport=page.getViewport({scale:1.4});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),canvas,viewport}).promise;fs.writeFileSync(path.join(out,`${template}-${pageNumber}.png`),canvas.toBuffer('image/png'))}
    }
    const assertAfter=(start,end)=>{
      const a=items.find(i=>i.str.includes(start)), b=items.find(i=>i.str.includes(end))
      assert.ok(a && b,`missing ${start} or ${end}`)
      assert.ok(b.page>a.page || (b.page===a.page && b.transform[5]+b.height <= a.transform[5]+1),`${end} overlaps ${start}: ${JSON.stringify({start:{page:a.page,y:a.transform[5]},end:{page:b.page,y:b.transform[5]}})}`)
    }
    for(let i=0;i<7;i++) assertAfter(`END${i}`,`NEXT${i+1}`)
    assertAfter('EXTRAEND','AFTEREXTRA')
    assert.ok(!items.some(i=>i.str.includes('\uFFFD')))
    await doc.cleanup()
  })
}

for (const template of ['minimal','business','creative']) {
  test(`${template}: 多经历分页不整块后推，非末页不留下大片空白`, async () => {
    const resume={basics:{name:'分页回归测试',title:'产品经理',email:'test@example.com'},metadata:{template},sections:['工作经历','实习经历','校园经历'].map((title,k)=>({type:'experience',id:String(k),title,items:[{title:'项目负责人',subtitle:'测试单位'+k,highlights:Array.from({length:15},(_,i)=>({title:`TASK${k}N${i}X`,text:'参与用户调研与需求分析，协调团队完成产品方案设计与落地，收集反馈并持续优化交付质量。'.repeat(2)}))}]}))}
    const bytes=await renderToBuffer(createElement(getTemplate(template),{resume}))
    const doc=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
    if(template==='minimal') assert.equal(doc.numPages,2,'不缩小字号、不删内容时应自然排为两页')
    const out=process.env.PDF_LAYOUT_ARTIFACTS
    if(out){fs.mkdirSync(out,{recursive:true});for(const file of fs.readdirSync(out).filter(file=>file.startsWith(`pagination-${template}-`)&&file.endsWith('.png'))) fs.unlinkSync(path.join(out,file));fs.writeFileSync(path.join(out,`pagination-${template}.pdf`),bytes)}
    const all=[]
    for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n)
      const items=(await page.getTextContent()).items.filter(i=>i.str?.trim())
      all.push(...items)
      const body=items.filter(i=>template!=='creative'||i.transform[4]>=178)
      assert.ok(body.length>0,'不能生成空白页')
      for(const bullet of body.filter(i=>i.str.trim()==='•')) {
        assert.ok(body.some(i=>i!==bullet && i.str.trim()!=='•' && Math.abs(i.transform[5]-bullet.transform[5])<3), '项目符号不能孤立在前一页')
      }
      if(n<doc.numPages) assert.ok(Math.min(...body.map(i=>i.transform[5]))<120,`第${n}页过早结束`)
      if(out){const viewport=page.getViewport({scale:1.3});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),canvas,viewport}).promise;fs.writeFileSync(path.join(out,`pagination-${template}-${n}.png`),canvas.toBuffer('image/png'))}
    }
    const text=all.map(i=>i.str).join('')
    for(let k=0;k<3;k++) for(let i=0;i<15;i++) assert.equal(text.split(`TASK${k}N${i}X`).length-1,1,'每条内容必须完整且只出现一次')
    for(const heading of ['工作经历','实习经历','校园经历']) assert.ok(text.includes(heading))
    await doc.cleanup()
  })
}

test('自定义模块图标的兜底可见，不使用圆点',async()=>{
  const {getSectionIconLabel}=await import('../lib/pdf/templates/section-helpers.ts')
  assert.equal(getSectionIconLabel('志愿服务'),'志')
  assert.equal(getSectionIconLabel('Research'),'R')
  assert.equal(getSectionIconLabel('  '),'简')
})
