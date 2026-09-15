const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, overrides = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(name => overrides[name] || require(name), module, module.exports)
  return module.exports
}

const analytics = load('lib/admin-analytics.ts')
assert.throws(() => analytics.overviewQuery(0))
assert.throws(() => analytics.detailQuery(["x' OR 1=1"]))
assert.throws(() => analytics.detailQuery(Array(26).fill('abc')))
assert.match(analytics.overviewQuery(7), /count\(DISTINCT person_id\)/)
assert.doesNotMatch(analytics.overviewQuery(7), /windowFunnel/)
assert.match(analytics.detailQuery(['abc']), /properties.analysis_id, properties.session_id/)
assert.equal(analytics.duration(null), '未知')
assert.equal(analytics.duration(1500), '1.5 秒')
assert.throws(() => analytics.parseAnalyticsRows([{ count: 1 }]))

const views = load('components/admin-reports.tsx', {
  '@/lib/admin-analytics': analytics,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
})
const report = { status: 'ready', rows: [['resume_copied', '', 3, null, 0]], updatedAt: new Date().toISOString() }
const overview = renderToStaticMarkup(React.createElement(views.AdminOverview, { report, days: 7 }))
assert.match(overview, /复制人数/)
assert.match(overview, /下载 PDF 人数/)
assert.match(overview, /开始面试人数/)
const record = { id: '1', session_id: 'abc', title: 'Role', created_at: new Date().toISOString(), score_before: 50, score_after: 80 }
const detail = renderToStaticMarkup(React.createElement(views.AnalysisDetails, {
  records: [record], report: { status: 'ready', rows: [['different-analysis', 'resume_copied', '', '', 1, null, '']], updatedAt: '' }, page: 5, days: 7, hasNext: true,
}))
assert.match(detail, /page=6/)
assert.match(detail, /未知 \/ 未观测到/)
assert.doesNotMatch(detail, /复制生成简历：已记录/)
console.log('Admin analytics query and rendering checks passed')
