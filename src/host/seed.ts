/**
 * dsh-agenda — 捆绑节假日 seed。
 *
 * 包内 `holidays/<year>.yaml`（官方数据，人工维护）在挂载时复制到
 * `<dataDir>/holidays/`，仅当对应年份不存在时写入；用户后续可自行编辑
 * 数据目录中的文件，插件不覆盖。
 */
import { readdir, readFile } from 'node:fs/promises'
import yaml from 'js-yaml'
import type { AgendaStorage, HolidayYear } from '../storage/storage.ts'

/** 解析 holidays/*.yaml 原始文本（宽松容错）。 */
export function parseHolidayYaml(raw: string, year: number): HolidayYear | null {
  try {
    const data = yaml.load(raw) as { holidays?: unknown, workdays?: unknown } | null
    if (typeof data !== 'object' || data === null) return null
    const holidays: Array<{ name: string, dates: string[] }> = []
    if (Array.isArray(data.holidays)) {
      for (const item of data.holidays) {
        if (typeof item !== 'object' || item === null) continue
        const entry = item as Record<string, unknown>
        const name = typeof entry.name === 'string' ? entry.name : ''
        const dates = Array.isArray(entry.dates) ? entry.dates.filter((d): d is string => typeof d === 'string') : []
        if (name !== '' && dates.length > 0) holidays.push({ name, dates })
      }
    }
    const workdays = Array.isArray(data.workdays)
      ? data.workdays.filter((d): d is string => typeof d === 'string')
      : []
    return { year, holidays, workdays }
  } catch {
    return null
  }
}

/**
 * 把捆绑的节假日数据补齐到数据目录。
 * @param storage 存储
 * @param packageRootUrl 包根目录的 import.meta.url（指向 holidays/ 父级）
 */
export async function seedBundledHolidays(storage: AgendaStorage, holidaysUrl: URL): Promise<number> {
  let entries: string[]
  try {
    entries = await readdir(holidaysUrl)
  } catch {
    return 0
  }
  let seeded = 0
  for (const entry of entries) {
    const match = /^(\d{4})\.ya?ml$/.exec(entry)
    if (match === null) continue
    const year = Number(match[1])
    const existing = await storage.readHolidayYear(year)
    if (existing !== null) continue
    const raw = await readFile(new URL(entry, holidaysUrl), 'utf8').catch(() => null)
    if (raw === null) continue
    const parsed = parseHolidayYaml(raw, year)
    if (parsed === null || parsed.holidays.length === 0) continue
    await storage.writeHolidayYear(parsed)
    seeded += 1
  }
  return seeded
}
