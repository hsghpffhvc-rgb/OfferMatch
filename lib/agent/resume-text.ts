/** Join layout-induced line breaks within a single prose field, without joining distinct items. */
export function joinResumeProse(value: string): string {
  const lines = value.replace(/\r\n?/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean)
  let result = ""
  for (const line of lines) {
    if (!result) { result = line; continue }
    const previous = result.slice(-1)
    const startsItem = /^(?:#{1,6}\s|[-*•·]\s|\d+[.)、]\s|[（(]\d+[)）])/.test(line)
    if (/[。！？!?]$/.test(result) || startsItem) {
      result += `\n${line}`
    } else {
      const separator = (/[A-Za-z]$/.test(previous) && /^[A-Za-z]/.test(line))
        || (/[–—-]$/.test(previous) && /^\d/.test(line)) ? " " : ""
      result += separator + line
    }
  }
  return result
}
