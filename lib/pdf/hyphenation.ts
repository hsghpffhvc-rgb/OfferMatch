/**
 * CJK 断行回调：中文没有空格分词，若不拆分，react-pdf 会把整段当成一个不可换行的长词。
 * 这里按「汉字单字 / 英文术语与数字整词」切分，既保证中文正常换行，也保证技术名词不被拆散。
 *
 * 注意：连字符 "-" 由 scripts/patch-react-pdf-cjk-hyphen.mjs 关闭（仅英文单词换行保留）。
 */
export function resumeHyphenationCallback(word: string): string[] {
  return (
    word.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[.+#/-][A-Za-z0-9]+)*|[^\s]/g) ?? [word]
  )
}
