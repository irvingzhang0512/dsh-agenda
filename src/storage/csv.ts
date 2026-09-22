/**
 * dsh-agenda — CSV 编解码（RFC 4180 子集）。
 *
 * 设计要点：
 * - 字段在需要时加引号（含逗号 / 引号 / CR / LF / 首尾空白）；
 * - 引号字段内的 `"` 转义为 `""`，可承载换行与全部中文；
 * - 解析为单趟状态机，容忍 CRLF / LF，剥离 UTF-8 BOM；
 * - 空文件 / 仅表头文件返回空数组。
 */

/** 解析一段 CSV 文本为行数组（每行为字段数组）。 */
export function parseCsv(text: string): string[][] {
  let src = text
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1) // strip BOM
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = (): void => {
    row.push(field)
    field = ''
  }
  const pushRow = (): void => {
    pushField()
    // 末尾空行（文件以换行结尾）不产出空行
    if (row.length === 1 && row[0] === '' && rows.length > 0 && i >= src.length) {
      row = []
      return
    }
    rows.push(row)
    row = []
  }
  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"' && field === '') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      pushField()
      i += 1
      continue
    }
    if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1
      pushRow()
      i += 1
      continue
    }
    if (ch === '\n') {
      pushRow()
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  if (field !== '' || row.length > 0 || inQuotes) pushRow()
  return rows
}

/** 单个字段是否需要加引号。 */
function needsQuote(value: string): boolean {
  return (
    value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')
    || value.startsWith(' ') || value.endsWith(' ') || value === ''
  )
}

/** 编码一个字段。 */
function encodeField(value: string): string {
  if (!needsQuote(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

/** 编码行数组为 CSV 文本（CRLF 行尾，结尾带换行）。 */
export function stringifyCsv(rows: string[][]): string {
  let out = ''
  for (const row of rows) {
    out += row.map(encodeField).join(',')
    out += '\r\n'
  }
  return out
}
