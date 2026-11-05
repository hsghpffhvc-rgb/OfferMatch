/**
 * react-pdf 在断行时会无条件插入连字符 "-"（Knuth & Plass penalty 断点），
 * 中文没有分词空格，整句话会被当作一个长词，于是每一行末尾都会出现多余的 "-"。
 *
 * 这里给 @react-pdf/textkit 打一个最小补丁：只有断点前一个字符是拉丁字母/数字时
 * 才插入连字符（英文单词换行需要），中文断行不插入任何字符。
 *
 * 用法：npm install 后自动执行（见 package.json 的 postinstall）。
 */
import fs from "node:fs"
import path from "node:path"

const MARKER = "/* cjk-hyphen-patch */"

const TARGETS = [
  "node_modules/@react-pdf/textkit/lib/textkit.js",
  "node_modules/@react-pdf/textkit/lib/textkit.cjs",
]

const ORIGINAL = "line = insertGlyph(line.string.length, HYPHEN, line);"
const PATCHED = `line = /[A-Za-z0-9]$/.test(line.string) ? insertGlyph(line.string.length, HYPHEN, line) : line; ${MARKER}`

let patchedCount = 0
let missingCount = 0

for (const relativePath of TARGETS) {
  const filePath = path.join(process.cwd(), relativePath)
  if (!fs.existsSync(filePath)) {
    missingCount += 1
    continue
  }

  const source = fs.readFileSync(filePath, "utf8")
  if (source.includes(MARKER)) continue
  if (!source.includes(ORIGINAL)) {
    console.warn(`[cjk-hyphen] 未找到断行代码，跳过：${relativePath}`)
    continue
  }

  fs.writeFileSync(filePath, source.replace(ORIGINAL, PATCHED), "utf8")
  patchedCount += 1
  console.log(`[cjk-hyphen] 已修补 ${relativePath}`)
}

if (patchedCount === 0 && missingCount === 0) {
  console.log("[cjk-hyphen] 补丁已是最新状态")
}
